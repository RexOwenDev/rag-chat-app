import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { SystemPromptForm } from '@/components/settings/settings-form';
import { MembersTable } from '@/components/settings/members-table';
import type { WorkspaceMember } from '@/components/settings/members-table';

export const metadata: Metadata = { title: 'Settings' };

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Settings page — Server Component.
 *
 * Pre-fetches workspace settings and member list (with email resolution via
 * service-role admin API) so the client components render without loading states.
 *
 * Non-members are redirected to the chat page.
 */
export default async function SettingsPage({ params }: PageProps) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify membership and get role
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect(`/workspaces/${workspaceId}/chat`);

  const isOwner = membership.role === 'owner';

  // Fetch workspace data
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, system_prompt')
    .eq('id', workspaceId)
    .single();

  // Fetch member list
  const { data: memberRows } = await supabase
    .from('workspace_members')
    .select('user_id, role, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });

  // Resolve user emails via service-role admin API
  const serviceClient = getServiceClient();
  const members: WorkspaceMember[] = [];

  for (const row of memberRows ?? []) {
    const userId = row.user_id as string;
    const { data: { user: memberUser } } = await serviceClient.auth.admin.getUserById(userId);
    members.push({
      userId,
      email: memberUser?.email ?? userId, // fallback to userId if email not available
      role: row.role as WorkspaceMember['role'],
      createdAt: row.created_at as string,
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage workspace configuration and team members.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isOwner ? (
          <SystemPromptForm
            workspaceId={workspaceId}
            initialName={(workspace?.name as string) ?? ''}
            initialSystemPrompt={(workspace?.system_prompt as string | null) ?? null}
          />
        ) : (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
            Only workspace owners can edit settings.
          </div>
        )}

        <MembersTable
          workspaceId={workspaceId}
          currentUserId={user.id}
          initialMembers={members}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
