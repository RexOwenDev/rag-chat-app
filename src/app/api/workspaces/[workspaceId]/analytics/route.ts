/**
 * GET /api/workspaces/[workspaceId]/analytics
 *
 * Returns aggregated analytics for the dashboard:
 *   - queriesPerDay    — daily query counts for the selected date range
 *   - topDocuments     — top 5 documents by citation count
 *   - avgLatencyMs     — mean latency across all queries in range
 *   - totalCostUsd     — sum of estimated API costs
 *   - totalQueries     — total query count in range
 *
 * Query params:
 *   dateRange: '7d' | '30d'  (default: '7d')
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAnalytics } from '@/lib/analytics/track';
import { analyticsQuerySchema } from '@/lib/validation/analytics';

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  // ─── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ─── Membership check ─────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── Validate query params ─────────────────────────────────────────────────
  const url = new URL(request.url);
  const parsed = analyticsQuerySchema.safeParse({
    dateRange: url.searchParams.get('dateRange') ?? '7d',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query params' },
      { status: 422 }
    );
  }

  // ─── Fetch analytics ───────────────────────────────────────────────────────
  try {
    const data = await getAnalytics(supabase, workspaceId, parsed.data.dateRange);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[analytics:GET] Failed to aggregate analytics', {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
