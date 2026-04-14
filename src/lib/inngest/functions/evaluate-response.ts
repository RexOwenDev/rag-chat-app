/**
 * Inngest function: evaluate-response
 *
 * Async RAG evaluation — runs after the chat stream completes.
 * Uses Claude Haiku to score each assistant response on two dimensions:
 *
 *   faithfulness — is the answer grounded in the retrieved context?
 *                  0 = fabricated, 1 = fully supported by documents
 *
 *   relevance    — does the answer address the user's question?
 *                  0 = completely off-topic, 1 = directly answers the question
 *
 * Scores are stored in messages.faithfulness_score and messages.relevance_score.
 * The chat UI picks them up when the user revisits the conversation.
 *
 * Uses Haiku (not Sonnet) — evaluation is cheap and speed doesn't matter here.
 * Retries: 2 per step (eval failures are non-fatal).
 */

import { gateway, generateText } from 'ai';
import { inngest } from '../client';
import type { InngestEvents } from '../client';
import { getServiceClient } from '@/lib/supabase/service';

const EVAL_MODEL = 'anthropic/claude-haiku-4.5';

/** Max characters of context to include in the eval prompt */
const MAX_EVAL_CONTEXT_CHARS = 6_000;

interface EvalScores {
  faithfulness: number | null;
  relevance: number | null;
}

export const evaluateResponse = inngest.createFunction(
  {
    id: 'evaluate-response',
    name: 'Evaluate RAG Response',
    retries: 2,
    // Inngest v4: trigger goes inside the options object alongside id/name
    triggers: [{ event: 'response/evaluate' as const }],
  },
  async ({ event, step }: { event: { data: InngestEvents['response/evaluate']['data'] }; step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> } }) => {
    const { messageId, query, response, contextChunkIds } = event.data;

    // ── Step 1: Fetch chunk content for faithfulness grounding ────────────────
    const chunkTexts = await step.run('fetch-context-chunks', async (): Promise<string[]> => {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from('chunks')
        .select('content')
        .in('id', contextChunkIds)
        .limit(5);

      return ((data ?? []) as Array<{ content: string }>).map((c) => c.content);
    });

    // ── Step 2: Evaluate with Claude Haiku ───────────────────────────────────
    const scores = await step.run('score-with-llm', async (): Promise<EvalScores> => {
      const contextText = chunkTexts
        .join('\n\n---\n\n')
        .slice(0, MAX_EVAL_CONTEXT_CHARS);

      const evalPrompt = `You are evaluating a RAG (Retrieval-Augmented Generation) response.

<retrieved_context>
${contextText}
</retrieved_context>

<user_question>
${query}
</user_question>

<assistant_response>
${response.slice(0, 3000)}
</assistant_response>

Score the assistant response on two dimensions. Return ONLY a JSON object, no other text:

{
  "faithfulness": <0.0 to 1.0>,
  "relevance": <0.0 to 1.0>
}

Scoring criteria:
- faithfulness: 1.0 = every claim is directly supported by the retrieved context. 0.0 = claims are fabricated or contradict the context.
- relevance: 1.0 = the response fully addresses the user's question. 0.0 = the response ignores or misunderstands the question.

Return only valid JSON. Do not include explanations.`;

      try {
        const { text } = await generateText({
          model: gateway(EVAL_MODEL),
          prompt: evalPrompt,
          providerOptions: {
            gateway: {
              tags: ['feature:rag-eval', 'env:production'],
            },
          },
        });

        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
          console.warn('[evaluate-response] No JSON found in eval response', { messageId });
          return { faithfulness: null, relevance: null };
        }

        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        const clamp = (v: unknown): number | null => {
          if (typeof v !== 'number' || isNaN(v)) return null;
          return Math.max(0, Math.min(1, v));
        };

        return {
          faithfulness: clamp(parsed['faithfulness']),
          relevance: clamp(parsed['relevance']),
        };
      } catch (err) {
        console.error('[evaluate-response] LLM eval failed', { messageId, err });
        return { faithfulness: null, relevance: null };
      }
    });

    // ── Step 3: Persist scores ────────────────────────────────────────────────
    await step.run('save-scores', async () => {
      const supabase = getServiceClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('messages') as any)
        .update({
          faithfulness_score: scores.faithfulness,
          relevance_score: scores.relevance,
        })
        .eq('id', messageId) as { error: { message: string } | null };

      if (error) {
        console.error('[evaluate-response] Failed to save scores', { messageId, error: error.message });
      }
    });

    return scores;
  }
);
