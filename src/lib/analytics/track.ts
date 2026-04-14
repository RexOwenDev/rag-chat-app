/**
 * Analytics tracking — query event persistence and aggregation.
 *
 * trackQueryEvent: called from the chat route's onFinish callback.
 * getAnalytics:    called by the analytics API route for dashboard data.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueryEventData {
  workspaceId: string;
  conversationId: string;
  userId: string;
  queryText: string;
  retrievedChunkIds: string[];
  rerankChunkIds: string[];
  responseTokens: number;
  latencyMs: number;
}

export interface AnalyticsData {
  queriesPerDay: Array<{ date: string; count: number }>;
  topDocuments: Array<{ documentId: string; title: string; citationCount: number }>;
  avgLatencyMs: number;
  totalCostUsd: number;
  totalQueries: number;
}

// claude-sonnet-4.6 approximate: $3/1M input + $15/1M output tokens
const COST_PER_OUTPUT_TOKEN = 0.000015;

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Persists a single query_events row.
 * Non-fatal: log and continue if insert fails.
 */
export async function trackQueryEvent(
  supabase: SupabaseClient,
  data: QueryEventData
): Promise<void> {
  const totalCostUsd = data.responseTokens * COST_PER_OUTPUT_TOKEN;

  const row = {
    workspace_id: data.workspaceId,
    conversation_id: data.conversationId,
    user_id: data.userId,
    query_text: data.queryText,
    retrieved_chunk_ids: data.retrievedChunkIds,
    reranked_chunk_ids: data.rerankChunkIds,
    response_tokens: data.responseTokens,
    total_cost_usd: totalCostUsd,
    latency_ms: data.latencyMs,
  };

  const { error } = await (supabase.from('query_events') as ReturnType<SupabaseClient['from']>).insert(row);
  if (error) {
    console.error('[analytics] Failed to track query event', error.message);
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Aggregates analytics data for the dashboard.
 * Three parallel queries for minimum latency.
 */
export async function getAnalytics(
  supabase: SupabaseClient,
  workspaceId: string,
  dateRange: '7d' | '30d'
): Promise<AnalyticsData> {
  const days = dateRange === '30d' ? 30 : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const [eventsResult, statsResult, citationResult] = await Promise.all([
    // Query 1: all event timestamps for per-day grouping
    (supabase.from('query_events') as ReturnType<SupabaseClient['from']>)
      .select('created_at')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since),

    // Query 2: latency + cost for aggregate KPIs
    (supabase.from('query_events') as ReturnType<SupabaseClient['from']>)
      .select('latency_ms, total_cost_usd')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since),

    // Query 3: reranked_chunk_ids for citation analysis (capped at 500 rows)
    (supabase.from('query_events') as ReturnType<SupabaseClient['from']>)
      .select('reranked_chunk_ids')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since)
      .limit(500),
  ]);

  // ── Queries per day ─────────────────────────────────────────────────────────
  type EventRow = { created_at: string };
  const eventRows = (eventsResult.data ?? []) as EventRow[];
  const countsByDate = new Map<string, number>();
  for (const row of eventRows) {
    const date = row.created_at.slice(0, 10);
    countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
  }
  const queriesPerDay = buildDateRange(days, countsByDate);

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  type StatsRow = { latency_ms: number | null; total_cost_usd: number | null };
  const statsRows = (statsResult.data ?? []) as StatsRow[];
  const totalQueries = statsRows.length;

  let totalLatency = 0;
  let totalCostUsd = 0;
  for (const row of statsRows) {
    totalLatency += row.latency_ms ?? 0;
    totalCostUsd += row.total_cost_usd ?? 0;
  }
  const avgLatencyMs = totalQueries > 0 ? Math.round(totalLatency / totalQueries) : 0;

  // ── Top cited documents ──────────────────────────────────────────────────────
  type CitationRow = { reranked_chunk_ids: string[] | null };
  const citationRows = (citationResult.data ?? []) as CitationRow[];

  const allChunkIds = citationRows.flatMap((r) => r.reranked_chunk_ids ?? []);
  const topDocuments = await resolveTopDocuments(supabase, allChunkIds);

  return { queriesPerDay, topDocuments, avgLatencyMs, totalCostUsd, totalQueries };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a full date range with zero-fill for missing days. */
function buildDateRange(
  days: number,
  counts: Map<string, number>
): Array<{ date: string; count: number }> {
  const result: Array<{ date: string; count: number }> = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = new Date(now - i * 86_400_000).toISOString().slice(0, 10);
    result.push({ date: dateStr, count: counts.get(dateStr) ?? 0 });
  }
  return result;
}

/** Resolves chunk IDs → document ID → title, returns top 5 by citation count. */
async function resolveTopDocuments(
  supabase: SupabaseClient,
  chunkIds: string[]
): Promise<Array<{ documentId: string; title: string; citationCount: number }>> {
  if (chunkIds.length === 0) return [];

  // Deduplicate chunk IDs before querying
  const uniqueChunkIds = [...new Set(chunkIds)];

  // Fetch chunk → document_id mapping
  const { data: chunkRows } = await (supabase.from('chunks') as ReturnType<SupabaseClient['from']>)
    .select('id, document_id')
    .in('id', uniqueChunkIds.slice(0, 2000)); // cap for DB safety

  type ChunkRow = { id: string; document_id: string };
  const chunkMap = new Map<string, string>(
    ((chunkRows ?? []) as ChunkRow[]).map((c) => [c.id, c.document_id])
  );

  // Count citations per document_id using original (non-deduped) chunk IDs
  const docCounts = new Map<string, number>();
  for (const cid of chunkIds) {
    const docId = chunkMap.get(cid);
    if (docId) docCounts.set(docId, (docCounts.get(docId) ?? 0) + 1);
  }

  // Sort and take top 5
  const topDocIds = [...docCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  if (topDocIds.length === 0) return [];

  // Fetch document titles
  const { data: docRows } = await (supabase.from('documents') as ReturnType<SupabaseClient['from']>)
    .select('id, title')
    .in('id', topDocIds)
    .is('deleted_at', null);

  type DocRow = { id: string; title: string };
  const docTitleMap = new Map<string, string>(
    ((docRows ?? []) as DocRow[]).map((d) => [d.id, d.title])
  );

  return topDocIds
    .map((docId) => ({
      documentId: docId,
      title: docTitleMap.get(docId) ?? 'Unknown Document',
      citationCount: docCounts.get(docId) ?? 0,
    }))
    .filter((d) => d.citationCount > 0);
}
