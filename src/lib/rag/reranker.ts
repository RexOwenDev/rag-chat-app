/**
 * Cohere Rerank 3 — cross-encoder reranking for hybrid search results.
 *
 * Takes up to `topN` candidates from hybrid_search and re-orders them
 * using Cohere's cross-encoder model, which jointly evaluates the query
 * and each document (unlike the bi-encoder embeddings used for retrieval).
 *
 * Graceful fallback: if COHERE_API_KEY is absent or the API call fails,
 * we return the input candidates in their original RRF order so the chat
 * pipeline never hard-fails due to a reranking outage.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import { RerankError } from '@/lib/errors';
import type { SearchResult, RerankResult } from '@/lib/types';

const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank';
const COHERE_MODEL = 'rerank-english-v3.0';

interface CohereRerankResponse {
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
}

interface RerankOptions {
  supabase: SupabaseClient;
  workspaceId: string;
  query: string;
  candidates: SearchResult[];
  topN?: number;
}

/**
 * Enriches SearchResult candidates with document metadata, then optionally
 * reranks them with Cohere. Returns typed RerankResult[].
 */
export async function rerank({
  supabase,
  workspaceId,
  query,
  candidates,
  topN = config.rag.rerankTopN,
}: RerankOptions): Promise<RerankResult[]> {
  if (candidates.length === 0) return [];

  // Fetch document titles for all unique document IDs in one query
  const documentIds = [...new Set(candidates.map((c) => c.document_id))];
  const { data: docs, error: docsError } = await supabase
    .from('documents')
    .select('id, title, source_type, source_url')
    .in('id', documentIds)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (docsError) {
    throw new RerankError(`Failed to fetch document metadata: ${docsError.message}`);
  }

  const docMap = new Map(
    (docs ?? []).map((d) => [d.id, d as { id: string; title: string; source_type: string; source_url: string | null }])
  );

  // Build enriched candidates (some docs may be missing if deleted mid-request)
  const enriched: RerankResult[] = candidates
    .map((c) => {
      const doc = docMap.get(c.document_id);
      return {
        chunkId: c.chunk_id,
        documentId: c.document_id,
        documentTitle: doc?.title ?? 'Unknown document',
        content: c.content,
        headingContext: c.heading_context,
        pageNumber: c.page_number,
        relevanceScore: c.rrf_score,
        sourceType: doc?.source_type ?? 'txt',
        sourceUrl: doc?.source_url ?? null,
      };
    })
    .slice(0, topN * 4); // cap before sending to Cohere (don't send 20 if topN is 5)

  // Attempt Cohere reranking — fall back to input order on any failure
  if (process.env.COHERE_API_KEY) {
    try {
      const response = await fetch(COHERE_RERANK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        },
        body: JSON.stringify({
          model: COHERE_MODEL,
          query,
          documents: enriched.map((c) => c.content),
          top_n: topN,
          return_documents: false,
        }),
        signal: AbortSignal.timeout(10_000), // 10s — reranking should be fast
      });

      if (!response.ok) {
        const body = await response.text();
        console.warn(`[reranker] Cohere API error (${response.status}): ${body.slice(0, 200)} — falling back to RRF order`);
        return enriched.slice(0, topN);
      }

      const data = (await response.json()) as CohereRerankResponse;

      // Map Cohere indices back to our enriched candidates
      return data.results.map((r) => ({
        ...enriched[r.index]!,
        relevanceScore: r.relevance_score,
      }));
    } catch (err) {
      // Network timeout, parse error, etc. — log and fall back
      console.warn('[reranker] Cohere call failed:', err instanceof Error ? err.message : String(err), '— falling back to RRF order');
      return enriched.slice(0, topN);
    }
  }

  // No API key configured — log once and return RRF order
  console.warn('[reranker] COHERE_API_KEY not set — returning RRF-ranked results without cross-encoder reranking');
  return enriched.slice(0, topN);
}
