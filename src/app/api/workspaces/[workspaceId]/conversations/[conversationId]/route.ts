/**
 * GET    /api/workspaces/[workspaceId]/conversations/[conversationId]
 *   Returns conversation metadata + all messages (oldest first).
 *   Used to restore a conversation on page load.
 *
 * PATCH  /api/workspaces/[workspaceId]/conversations/[conversationId]
 *   Updates the conversation title (set from the first user message).
 *
 * DELETE /api/workspaces/[workspaceId]/conversations/[conversationId]
 *   Hard-deletes the conversation and its messages (cascaded by FK).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  // Conversation RLS already enforces user_id = auth.uid()
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, title, workspace_id, created_at, updated_at')
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabase
    .from('messages')
    .select('id, role, content, cited_chunk_ids, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('[conversations/[id]:GET] Failed to load messages', { conversationId, error: msgError.message });
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  return NextResponse.json({ conversation, messages: messages ?? [] });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId, conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as { title?: string };
  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const update = { title: body.title.slice(0, 200), updated_at: new Date().toISOString() };

  const { error } = await supabase
    .from('conversations')
    .update(update)
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[conversations/[id]:PATCH] DB error', { conversationId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { workspaceId, conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[conversations/[id]:DELETE] DB error', { conversationId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
