/**
 * PATCH /api/workspaces/[workspaceId]
 *
 * Updates workspace settings (name, system_prompt).
 * Restricted to workspace owners only.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

const patchWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  system_prompt: z.string().max(4000).nullable().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only owners can update workspace settings
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden: owner role required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 422 }
    );
  }

  // Build update object — only include provided fields
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update['name'] = parsed.data.name;
  if (parsed.data.system_prompt !== undefined) update['system_prompt'] = parsed.data.system_prompt;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .update(update)
    .eq('id', workspaceId)
    .select('id, name, system_prompt')
    .single();

  if (error) {
    console.error('[workspace:PATCH] DB error', { workspaceId, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspace });
}
