/**
 * POST /api/workspaces/[workspaceId]/documents
 *
 * Accepts either:
 *   - multipart/form-data with "file" field (PDF, DOCX, TXT, MD)
 *   - application/json with { url, title? }
 *
 * Flow:
 *   1. Auth check
 *   2. RBAC: owner or editor only
 *   3. Rate limit: 10 uploads / user / 10 min
 *   4. Validate input (Zod + file type/size)
 *   5a. File: upload to Supabase Storage
 *   5b. URL: validate only (extraction happens in Inngest)
 *   6. Insert document row (status: 'pending')
 *   7. Send Inngest event → triggers background processing
 *   8. Return { document }
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { inngest } from '@/lib/inngest/client';
import {
  fileUploadSchema,
  urlImportSchema,
  validateUploadedFile,
} from '@/lib/validation/documents';
import { assertSafeURL } from '@/lib/rag/extractors/ssrf';
import { config } from '@/lib/config';

// Rate limiter: sliding window, 10 uploads per user per 10 minutes
const uploadRatelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(config.rateLimit.uploadPerUserPer10Min, '10 m'),
  prefix: 'ratelimit:upload',
});

function sourceTypeFromExtension(
  ext: string
): 'pdf' | 'docx' | 'txt' | 'md' {
  const map: Record<string, 'pdf' | 'docx' | 'txt' | 'md'> = {
    pdf: 'pdf',
    docx: 'docx',
    txt: 'txt',
    md: 'md',
  };
  return map[ext] ?? 'txt';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) =>
          cs.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, sameSite: 'lax' })
          ),
      },
    }
  );

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. RBAC ───────────────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'editor'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to upload documents to this workspace.' },
      { status: 403 }
    );
  }

  // ── 3. Rate limit ─────────────────────────────────────────────────────────
  const { success, reset, remaining } = await uploadRatelimit.limit(user.id);
  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: `Rate limited. You can upload ${config.rateLimit.uploadPerUserPer10Min} documents per 10 minutes. Try again shortly.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Remaining': String(remaining),
        },
      }
    );
  }

  const contentType = request.headers.get('content-type') ?? '';

  // ── File upload ───────────────────────────────────────────────────────────
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Send a multipart/form-data request with a "file" field.' },
        { status: 400 }
      );
    }

    // 4. Validate
    try {
      validateUploadedFile(file);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid file.' },
        { status: 400 }
      );
    }

    const rawTitle = (formData.get('title') as string | null)?.trim();
    const title = rawTitle || file.name.replace(/\.[^.]+$/, '').slice(0, 255);
    const titleParsed = fileUploadSchema.safeParse({ title });
    if (!titleParsed.success) {
      return NextResponse.json(
        { error: titleParsed.error.issues[0]?.message ?? 'Invalid title.' },
        { status: 422 }
      );
    }

    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const sourceType = sourceTypeFromExtension(extension);
    const documentId = crypto.randomUUID();
    const storagePath = `workspaces/${workspaceId}/${documentId}`;

    // 5a. Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: storageError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (storageError) {
      console.error('[documents] Storage upload error:', storageError.message);
      return NextResponse.json(
        { error: 'Failed to upload file. Please try again.' },
        { status: 500 }
      );
    }

    // 6. Insert document row
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        workspace_id: workspaceId,
        uploaded_by: user.id,
        title: titleParsed.data.title,
        source_type: sourceType,
        storage_path: storagePath,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !document) {
      // Clean up orphaned storage file
      await supabase.storage.from('documents').remove([storagePath]);
      console.error('[documents] Insert error:', insertError?.message);
      return NextResponse.json(
        { error: 'Failed to register document. Please try again.' },
        { status: 500 }
      );
    }

    // 7. Send Inngest event — if this fails, roll back the DB row and storage file
    // so the document doesn't get stuck permanently in 'pending' with no processor.
    try {
      await inngest.send({
        name: 'document/process',
        data: {
          documentId: document.id,
          workspaceId,
          storagePath,
          sourceType,
        },
      });
    } catch (inngestErr) {
      console.error('[documents] Failed to dispatch Inngest event for file upload', inngestErr);
      await Promise.allSettled([
        supabase.from('documents').delete().eq('id', document.id),
        supabase.storage.from('documents').remove([storagePath]),
      ]);
      return NextResponse.json(
        { error: 'Failed to start document processing. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ document }, { status: 201 });
  }

  // ── URL import ────────────────────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const parsed = urlImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
        { status: 422 }
      );
    }

    const { url, title: rawTitle } = parsed.data;

    // 4. SSRF guard — check before creating any DB rows
    try {
      await assertSafeURL(url);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Invalid URL.' },
        { status: 400 }
      );
    }

    const title = (rawTitle?.trim() || url).slice(0, 255);
    const documentId = crypto.randomUUID();

    // 6. Insert document row (no storage path for URL docs)
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        id: documentId,
        workspace_id: workspaceId,
        uploaded_by: user.id,
        title,
        source_type: 'url',
        source_url: url,
        storage_path: null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !document) {
      console.error('[documents] Insert error:', insertError?.message);
      return NextResponse.json(
        { error: 'Failed to register document. Please try again.' },
        { status: 500 }
      );
    }

    // 7. Send Inngest event — if this fails, roll back the DB row
    // so the document doesn't get stuck permanently in 'pending' with no processor.
    try {
      await inngest.send({
        name: 'document/process',
        data: {
          documentId: document.id,
          workspaceId,
          storagePath: null,
          sourceType: 'url',
          sourceUrl: url,
        },
      });
    } catch (inngestErr) {
      console.error('[documents] Failed to dispatch Inngest event for URL import', inngestErr);
      await supabase.from('documents').delete().eq('id', document.id);
      return NextResponse.json(
        { error: 'Failed to start document processing. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ document }, { status: 201 });
  }

  return NextResponse.json(
    { error: 'Unsupported content type. Use multipart/form-data for files or application/json for URLs.' },
    { status: 415 }
  );
}
