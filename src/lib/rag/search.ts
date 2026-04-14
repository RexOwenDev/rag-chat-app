/**
 * Hybrid search wrapper around the `hybrid_search` Postgres RPC.
 *
 * The RPC merges pgvector cosine similarity (vector search) with
 * PostgreSQL full-text search (BM25) using Reciprocal Rank Fusion.
 * This is why it beats pure vector search on keyword-heavy queries.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import type { SearchResult } from '@/lib/types';

interface HybridSearchOptions {
  supabase: SupabaseClient;
  workspaceId: string;
  queryText: string;
  queryEmbedding: number[];
  matchCount?: number;
}

/**
 * Runs hybrid BM25 + vector search via the `hybrid_search` Supabase RPC.
 * Returns up to `matchCount` chunks ranked by RRF score (descending).
 */
export async function hybridSearch({
  supabase,
  workspaceId,
  queryText,
  queryEmbedding,
  matchCount = config.rag.searchCandidates,
}: HybridSearchOptions): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc('hybrid_search', {
    p_workspace_id: workspaceId,
    p_query_text: queryText,
    p_query_embedding: queryEmbedding,
    p_match_count: matchCount,
    p_rrf_k: 60,
  });

  if (error) {
    throw new Error(`hybrid_search RPC failed: ${error.message}`);
  }

  // The RPC returns snake_case columns matching SearchResult exactly
  return (data ?? []) as SearchResult[];
}
