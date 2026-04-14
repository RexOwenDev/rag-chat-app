/**
 * DELETE /api/workspaces/[workspaceId]/members/[userId]
 *
 * Removes a member from the workspace. Owner-only.
 * Guards:
 *   - Cannot remove the last owner (would leave workspace ownerless)
 *   - Cannot remove yourself if you are the last owner
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ workspaceId: string; userId: string }>;
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { workspaceId, userId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owners can remove members
  const { data: callerMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!callerMembership || callerMembership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 });
  }

  // Verify the target user is actually a member
  const { data: targetMembership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (!targetMembership) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Prevent removing the last owner
  if (targetMembership.role === 'owner') {
    const { count } = await supabase
      .from('workspace_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner');

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last owner. Transfer ownership first.' },
        { status: 409 }
      );
    }
  }

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    console.error('[members/[userId]:DELETE] DB error', { workspaceId, userId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
