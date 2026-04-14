'use client';

/**
 * AnalyticsDashboard — full analytics view for a workspace.
 *
 * Data is fetched client-side via TanStack Query (QueryClientProvider
 * is already mounted at the root in src/components/providers.tsx).
 *
 * Layout:
 *   - Date range selector (7d / 30d)
 *   - 4 KPI cards
 *   - Queries per day AreaChart
 *   - Top cited documents BarChart
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from './kpi-card';
import { QueriesChart } from './queries-chart';
import { TopDocumentsChart } from './top-documents-chart';
import type { AnalyticsData } from '@/lib/analytics/track';

interface AnalyticsDashboardProps {
  workspaceId: string;
}

export function AnalyticsDashboard({ workspaceId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d'>('7d');

  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ['analytics', workspaceId, dateRange],
    queryFn: () =>
      fetch(`/api/workspaces/${workspaceId}/analytics?dateRange=${dateRange}`).then(
        (r) => r.json() as Promise<AnalyticsData>
      ),
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Date range selector */}
      <div className="flex gap-2">
        {(['7d', '30d'] as const).map((range) => (
          <Button
            key={range}
            size="sm"
            variant={dateRange === range ? 'default' : 'outline'}
            onClick={() => setDateRange(range)}
            className="h-7 px-3 text-xs"
          >
            {range === '7d' ? 'Last 7 days' : 'Last 30 days'}
          </Button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && <AnalyticsSkeleton />}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load analytics. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data?.totalQueries === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">No data yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Analytics will appear once you&apos;ve had your first conversation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard */}
      {!isLoading && !isError && data && data.totalQueries > 0 && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              title="Total Queries"
              value={data.totalQueries.toLocaleString()}
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <KpiCard
              title="Avg Latency"
              value={`${data.avgLatencyMs.toLocaleString()} ms`}
              icon={<Clock className="h-4 w-4" />}
            />
            <KpiCard
              title="Est. Cost"
              value={`$${data.totalCostUsd.toFixed(4)}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KpiCard
              title="Docs Cited"
              value={data.topDocuments.length}
              icon={<FileText className="h-4 w-4" />}
            />
          </div>

          {/* Queries chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Queries per Day</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <QueriesChart data={data.queriesPerDay} />
            </CardContent>
          </Card>

          {/* Top documents chart */}
          {data.topDocuments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Top Documents by Citation
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <TopDocumentsChart data={data.topDocuments} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-52 w-full rounded-xl" />
    </div>
  );
}
