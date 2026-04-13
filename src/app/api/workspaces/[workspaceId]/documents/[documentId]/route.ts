/**
 * DELETE /api/workspaces/[workspaceId]/documents/[documentId]
 *
 * Soft-deletes a document by setting deleted_at = now().
 * Chunks are preserved in the DB until the nightly cron permanently purges
 * documents that have been soft-deleted for longer than config.softDelete.purgeAfterDays.
 *
 * RBAC: owner or editor only.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; documentId: string }> }
) {
  const { workspaceId, documentId } = await params;
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

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RBAC — must be owner or editor
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || !['owner', 'editor'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'You do not have permission to delete documents in this workspace.' },
      { status: 403 }
    );
  }

  // Verify document belongs to this workspace and is not already deleted
  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, deleted_at')
    .eq('id', documentId)
    .eq('workspace_id', workspaceId)
    .single();

  if (!doc) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  if (doc.deleted_at) {
    return NextResponse.json({ error: 'Document is already deleted.' }, { status: 409 });
  }

  // Soft delete — set deleted_at, do NOT cascade-delete chunks
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('workspace_id', workspaceId);

  if (updateError) {
    console.error('[documents] Soft delete failed:', updateError.message);
    return NextResponse.json(
      { error: 'Failed to delete document. Please try again.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
