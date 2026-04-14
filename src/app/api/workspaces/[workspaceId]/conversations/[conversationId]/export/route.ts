/**
 * GET /api/workspaces/[workspaceId]/conversations/[conversationId]/export
 *
 * Generates a PDF transcript of the conversation and returns it as an
 * attachment download. Resolves cited document titles from chunk IDs so
 * the PDF includes source attribution per assistant message.
 *
 * Server-only: @react-pdf/renderer must never run in the browser.
 */
import 'server-only';
import { createElement } from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createClient } from '@/lib/supabase/server';
import { ConversationDocument } from '@/lib/pdf/conversation-document';
import type { PdfMessage } from '@/lib/pdf/conversation-document';

interface RouteContext {
  params: Promise<{ workspaceId: string; conversationId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { workspaceId, conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify workspace membership
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Fetch conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, title, workspace_id')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  // Fetch workspace name
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .single();

  // Fetch messages with citation and eval data
  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, role, content, cited_chunk_ids, faithfulness_score, relevance_score')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('[export:GET] Failed to load messages', { conversationId, error: msgError.message });
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json(
      { error: 'This conversation has no messages to export.' },
      { status: 422 }
    );
  }

  // Resolve chunk IDs → document titles
  const allChunkIds = Array.from(
    new Set(
      (messages ?? []).flatMap((m) => (m.cited_chunk_ids as string[] | null) ?? [])
    )
  );

  const chunkDocTitles = new Map<string, string>();

  if (allChunkIds.length > 0) {
    const { data: chunks } = await supabase
      .from('chunks')
      .select('id, document_id')
      .in('id', allChunkIds);

    if (chunks && chunks.length > 0) {
      const docIds = Array.from(new Set(chunks.map((c) => c.document_id as string)));

      const { data: docs } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', docIds);

      const docTitleMap = new Map(
        (docs ?? []).map((d) => [d.id as string, d.title as string])
      );

      for (const chunk of chunks) {
        const title = docTitleMap.get(chunk.document_id as string);
        if (title) chunkDocTitles.set(chunk.id as string, title);
      }
    }
  }

  // Build typed message list for the PDF template
  const pdfMessages: PdfMessage[] = (messages ?? []).map((m) => {
    const chunkIds = (m.cited_chunk_ids as string[] | null) ?? [];
    const citedDocTitles = Array.from(
      new Set(
        chunkIds
          .map((id) => chunkDocTitles.get(id))
          .filter((t): t is string => t !== undefined)
      )
    );

    return {
      id: m.id as string,
      role: m.role as string,
      content: m.content as string,
      citedDocTitles,
      faithfulnessScore: (m.faithfulness_score as number | null) ?? null,
      relevanceScore: (m.relevance_score as number | null) ?? null,
    };
  });

  const title = (conversation.title as string | null) ?? 'Conversation Export';
  const workspaceName = (workspace?.name as string | undefined) ?? 'Workspace';
  const exportedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Render PDF — use createElement to avoid needing .tsx extension in the route file
  const pdfElement = createElement(ConversationDocument, {
    title,
    workspaceName,
    exportedAt,
    messages: pdfMessages,
  });

  const pdfBuffer = await renderToBuffer(pdfElement);
  // Slice to an independent ArrayBuffer (Node.js Buffer.buffer is always non-shared)
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength
  ) as ArrayBuffer;

  const filename = `conversation-${conversationId.slice(0, 8)}.pdf`;

  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.byteLength),
    },
  });
}
