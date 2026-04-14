/**
 * GET  /api/workspaces/[workspaceId]/conversations
 *   Lists conversations for the current user in this workspace, sorted by
 *   most recently updated. Used to populate the conversation sidebar.
 *
 * POST /api/workspaces/[workspaceId]/conversations
 *   Creates a new conversation. Returns { conversationId }.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(config.pagination.conversationsPerPage);

  if (error) {
    console.error('[conversations:GET] DB error', { workspaceId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify user is a member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = {
    workspace_id: workspaceId,
    user_id: user.id,
    title: null,
  };

  const { data, error } = await supabase.from('conversations').insert(row).select('id').single();

  if (error) {
    console.error('[conversations:POST] DB error', { workspaceId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId: data.id }, { status: 201 });
}
