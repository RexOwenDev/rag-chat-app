import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { DocumentManager } from '@/components/documents/document-manager';
import type { WorkspaceRole } from '@/lib/types';

export const metadata: Metadata = { title: 'Documents' };

interface DocumentsPageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  // Fetch in parallel: documents list + current user's role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: documents }, { data: member }] = await Promise.all([
    supabase
      .from('documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user?.id ?? '')
      .single(),
  ]);

  return (
    <DocumentManager
      workspaceId={workspaceId}
      initialDocs={documents ?? []}
      userRole={(member?.role as WorkspaceRole | null) ?? 'viewer'}
    />
  );
}
