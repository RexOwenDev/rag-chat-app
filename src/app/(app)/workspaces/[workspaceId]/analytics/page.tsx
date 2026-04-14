import type { Metadata } from 'next';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';

export const metadata: Metadata = { title: 'Analytics' };

interface PageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Analytics page — Server Component shell.
 * All data is fetched client-side by AnalyticsDashboard via TanStack Query.
 */
export default async function AnalyticsPage({ params }: PageProps) {
  const { workspaceId } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Query performance and document usage insights for this workspace.
        </p>
      </div>
      <AnalyticsDashboard workspaceId={workspaceId} />
    </div>
  );
}
