import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/shell/app-shell';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  // Next.js 16: params is a Promise — must await
  const { workspaceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/workspaces/${workspaceId}`);
  }

  // Verify the user is a member of this workspace (RLS also enforces this at DB level)
  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!member) {
    // User is authenticated but not a member of this workspace
    redirect('/workspaces');
  }

  return (
    <AppShell user={user} workspaceId={workspaceId}>
      {children}
    </AppShell>
  );
}
