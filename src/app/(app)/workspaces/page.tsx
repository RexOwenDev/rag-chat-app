import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * /workspaces — redirects to the user's first workspace.
 * Later this becomes a workspace selector UI.
 */
export default async function WorkspacesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (memberships && memberships.length > 0 && memberships[0]) {
    redirect(`/workspaces/${memberships[0].workspace_id}/chat`);
  }

  // No workspaces yet — show a friendly placeholder
  return (
    <main className="flex h-screen items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-semibold">Welcome to KnowledgeBase AI</h1>
        <p className="text-muted-foreground text-sm">
          You are not a member of any workspace yet.
          <br />
          Ask your administrator to invite you.
        </p>
      </div>
    </main>
  );
}
