/**
 * Shared TypeScript types derived from the Supabase schema.
 * Keep in sync with supabase/migrations/002_core_tables.sql.
 */

export type DocumentSourceType = 'pdf' | 'docx' | 'txt' | 'md' | 'url';
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error';
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  org_id: string;
  name: string;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  uploaded_by: string;
  title: string;
  source_type: DocumentSourceType;
  source_url: string | null;
  storage_path: string | null;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  page_count: number | null;
  version: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  workspace_id: string;
  content: string;
  heading_context: string | null;
  page_number: number | null;
  chunk_index: number;
  token_count: number;
  embedding: number[] | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  cited_chunk_ids: string[];
  faithfulness_score: number | null;
  relevance_score: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface QueryEvent {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  user_id: string;
  query_text: string;
  retrieved_chunk_ids: string[];
  reranked_chunk_ids: string[];
  response_tokens: number | null;
  total_cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
}

/** Chunk returned by hybrid_search RPC, enriched with document info */
export interface SearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  heading_context: string | null;
  page_number: number | null;
  rrf_score: number;
}

/** Reranked search result, enriched with Cohere relevance score */
export interface RerankResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  headingContext: string | null;
  pageNumber: number | null;
  relevanceScore: number;
}
