/**
 * Loads and trims conversation history from the database.
 *
 * History is trimmed from the oldest end when the total estimated token
 * count exceeds a budget. This keeps the RAG context + system prompt from
 * being crowded out by long conversation threads.
 *
 * Token estimation: 1 token ≈ 4 characters (rough but fast, avoids tiktoken).
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CHARS_PER_TOKEN = 4;
const HISTORY_TOKEN_BUDGET = 6_000; // tokens reserved for history

/**
 * Loads all messages for a conversation, sorted oldest-first, then trims
 * from the oldest end to fit within the token budget.
 */
export async function loadHistory(
  supabase: SupabaseClient,
  conversationId: string
): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    // Non-fatal: if history can't be loaded, start fresh
    console.warn('[history] Failed to load messages for conversation', conversationId, error.message);
    return [];
  }

  const messages = (data ?? []) as HistoryMessage[];

  // Trim oldest messages until total fits within budget
  const budget = HISTORY_TOKEN_BUDGET * CHARS_PER_TOKEN; // in chars
  let totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  let start = 0;

  while (totalChars > budget && start < messages.length) {
    totalChars -= messages[start]!.content.length;
    start++;
  }

  return messages.slice(start);
}

/**
 * Saves a single message to the database.
 * Called in onFinish to persist both user and assistant turns.
 */
export async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  meta?: {
    retrievedChunkIds?: string[];
    citedChunkIds?: string[];
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<void> {
  const row = {
    conversation_id: conversationId,
    role,
    content,
    retrieved_chunk_ids: meta?.retrievedChunkIds ?? [],
    cited_chunk_ids: meta?.citedChunkIds ?? [],
    input_tokens: meta?.inputTokens ?? null,
    output_tokens: meta?.outputTokens ?? null,
  };

  const { error } = await supabase.from('messages').insert(row);

  if (error) {
    // Non-fatal: message persistence failure shouldn't break the streaming response
    console.error('[history] Failed to save message:', error.message);
  }
}
