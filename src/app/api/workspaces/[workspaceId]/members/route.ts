/**
 * GET  /api/workspaces/[workspaceId]/members
 *   Lists all members with their roles. Any member can view.
 *
 * POST /api/workspaces/[workspaceId]/members
 *   Adds a member by email address. Owner-only.
 *   The user must already have an account (magic link sign-in).
 *   In production, replace the user lookup with a profiles table index.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const inviteMemberSchema = z.object({
  email: z.email(),
  role: z.enum(['editor', 'viewer']).default('viewer'),
});

export async function GET(_request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify caller is a member
  const { data: callerMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!callerMembership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: members, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[members:GET] DB error', { workspaceId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: members ?? [] });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owners can add members
  const { data: callerMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!callerMembership || callerMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 422 }
    );
  }

  const { email, role } = parsed.data;

  // Look up the user by email via admin API (service role required)
  // Note: In production with many users, replace with a profiles table query
  const serviceClient = getServiceClient();
  const { data: usersData, error: listError } = await serviceClient.auth.admin.listUsers({
    perPage: 1000,
  });

  if (listError) {
    console.error('[members:POST] Failed to list users', listError.message);
    return NextResponse.json({ error: 'Failed to look up user' }, { status: 500 });
  }

  const targetUser = usersData.users.find((u) => u.email === email);
  if (!targetUser) {
    return NextResponse.json(
      { error: 'No account found for that email. The user must sign up first.' },
      { status: 404 }
    );
  }

  // Prevent self-invite
  if (targetUser.id === user.id) {
    return NextResponse.json({ error: 'You are already a member of this workspace' }, { status: 409 });
  }

  // Upsert membership (handles re-invite gracefully)
  const { error: insertError } = await supabase
    .from('workspace_members')
    .upsert(
      { workspace_id: workspaceId, user_id: targetUser.id, role },
      { onConflict: 'workspace_id,user_id', ignoreDuplicates: false }
    );

  if (insertError) {
    console.error('[members:POST] Failed to add member', { workspaceId, error: insertError.message });
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: targetUser.id, role }, { status: 201 });
}
