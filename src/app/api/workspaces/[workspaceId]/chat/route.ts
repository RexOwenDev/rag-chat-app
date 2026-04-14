/**
 * POST /api/workspaces/[workspaceId]/chat
 *
 * Full RAG pipeline — streaming chat with citations:
 *   1. Auth + rate limit (per-user AND per-IP sliding windows)
 *   2. Zod validate request body
 *   3. Get or create conversation
 *   4. Load conversation history (token-budget trimmed)
 *   5. Save user message to DB (before streaming — available on reload)
 *   6. Embed query → hybrid_search (top-20) → Cohere rerank (top-5)
 *   7. Build context block + citation metadata
 *   8. Fetch workspace system_prompt
 *   9. Stream via Anthropic Claude with RAG system prompt
 *  10. onFinish: save assistant message + track query_events row
 *
 * Response: UI message stream (AI SDK v6 wire format).
 * Client reads it with readUIMessageStream() in use-chat.ts.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import {
  gateway,
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import type { ModelMessage } from 'ai';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { createClient } from '@/lib/supabase/server';
import { embedText } from '@/lib/rag/embedder';
import { hybridSearch } from '@/lib/rag/search';
import { rerank } from '@/lib/rag/reranker';
import { buildContext } from '@/lib/rag/context';
import { buildRAGSystemPrompt } from '@/lib/rag/prompts';
import { loadHistory, saveMessage } from '@/lib/chat/history';
import { inngest } from '@/lib/inngest/client';
import { trackQueryEvent } from '@/lib/analytics/track';
import { chatRequestSchema } from '@/lib/validation/chat';
import { config } from '@/lib/config';
import type { MessageCitation } from '@/lib/types';

export const maxDuration = 60;

// Rate limiters — lazily created so they don't fail at module load when env vars are absent
let _userLimiter: Ratelimit | null = null;
let _ipLimiter: Ratelimit | null = null;

function getUserLimiter(): Ratelimit {
  if (!_userLimiter) {
    _userLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(config.rateLimit.chatPerUserPerMin, '1 m'),
      prefix: 'rl:chat:user',
    });
  }
  return _userLimiter;
}

function getIpLimiter(): Ratelimit {
  if (!_ipLimiter) {
    _ipLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(config.rateLimit.chatPerIpPerMin, '1 m'),
      prefix: 'rl:chat:ip',
    });
  }
  return _ipLimiter;
}

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const supabase = await createClient();

  // ─── Auth ────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // ─── Membership check ────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── Rate limiting ───────────────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const [userLimit, ipLimit] = await Promise.all([
    getUserLimiter().limit(user.id),
    getIpLimiter().limit(ip),
  ]);

  if (!userLimit.success || !ipLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before sending another message.' },
      {
        status: 429,
        headers: { 'Retry-After': '60' },
      }
    );
  }

  // ─── Validate request body ───────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 422 }
    );
  }

  const { messages, conversationId: existingConversationId } = parsed.data;
  const userQuery = messages.at(-1)?.content ?? '';
  if (!userQuery) {
    return NextResponse.json({ error: 'No user message found' }, { status: 400 });
  }

  // ─── Get or create conversation ──────────────────────────────────────────
  let conversationId = existingConversationId;
  if (!conversationId) {
    const newConvRow = { workspace_id: workspaceId, user_id: user.id, title: null };
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert(newConvRow)
      .select('id')
      .single();

    if (convError || !newConv) {
      console.error('[chat] Failed to create conversation', { workspaceId, error: convError?.message });
      return NextResponse.json({ error: 'Failed to start conversation' }, { status: 500 });
    }
    conversationId = newConv.id as string;

    // Set conversation title from first user message (truncated)
    const title = userQuery.slice(0, 100);
    await supabase.from('conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', conversationId);
  }

  // ─── Load history + save user message ───────────────────────────────────
  const [history] = await Promise.all([
    loadHistory(supabase, conversationId),
    saveMessage(supabase, conversationId, 'user', userQuery),
  ]);

  const t0 = Date.now();

  // ─── RAG pipeline ─────────────────────────────────────────────────────────
  let citations: MessageCitation[] = [];
  let retrievedChunkIds: string[] = [];
  let rerankChunkIds: string[] = [];

  try {
    const queryEmbedding = await embedText(userQuery);

    const candidates = await hybridSearch({
      supabase,
      workspaceId,
      queryText: userQuery,
      queryEmbedding,
    });
    retrievedChunkIds = candidates.map((c) => c.chunk_id);

    const reranked = await rerank({
      supabase,
      workspaceId,
      query: userQuery,
      candidates,
    });
    rerankChunkIds = reranked.map((c) => c.chunkId);

    const { contextBlock, citations: builtCitations } = buildContext(reranked);
    citations = builtCitations;

    // Fetch workspace system prompt
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('system_prompt')
      .eq('id', workspaceId)
      .single();

    const systemPrompt = buildRAGSystemPrompt(contextBlock, workspace?.system_prompt ?? null);

    // Build message history for Claude using ModelMessage format (role + content).
    // UIMessage v6 has no content field — history is stored as plain text in DB.
    const claudeMessages: ModelMessage[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: userQuery },
    ];

    // ─── Stream response with citations ───────────────────────────────────
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Send citation metadata as a typed data part before the text stream.
        // Client reads this via isDataUIPart(part) where part.type === 'data-citations'.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (writer as any).write({ type: 'data-citations', data: citations });

        const result = streamText({
          model: gateway('anthropic/claude-sonnet-4.6'),
          system: systemPrompt,
          messages: claudeMessages,
          providerOptions: {
            gateway: {
              user: user.id,
              order: ['anthropic', 'bedrock'],
              tags: ['feature:rag-chat', 'env:production'],
            },
          },
          onFinish: async ({ text, usage }) => {
            const latencyMs = Date.now() - t0;

            // Run DB writes in parallel; capture assistant message ID for eval
            const [assistantMsgId] = await Promise.all([
              saveMessage(supabase, conversationId!, 'assistant', text, {
                retrievedChunkIds,
                citedChunkIds: rerankChunkIds,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              }),
              supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId),
              trackQueryEvent(supabase, {
                workspaceId,
                conversationId: conversationId!,
                userId: user.id,
                queryText: userQuery,
                retrievedChunkIds,
                rerankChunkIds,
                responseTokens: usage.outputTokens ?? 0,
                latencyMs,
              }),
            ]);

            // Fire-and-forget: async eval runs in Inngest after the stream completes
            if (assistantMsgId) {
              void inngest.send({
                name: 'response/evaluate',
                data: {
                  messageId: assistantMsgId,
                  conversationId: conversationId!,
                  query: userQuery,
                  response: text,
                  contextChunkIds: rerankChunkIds,
                },
              });
            }
          },
        });

        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({
      stream,
      headers: { 'X-Conversation-Id': conversationId },
    });
  } catch (err) {
    console.error('[chat] RAG pipeline error', { workspaceId, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Failed to process your request. Please try again.' }, { status: 500 });
  }
}

