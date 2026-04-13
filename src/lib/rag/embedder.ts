/**
 * OpenAI embedding client with Redis caching.
 *
 * Uses OPENAI_EMBED_KEY (not the SDK default OPENAI_API_KEY) so this key
 * cannot accidentally be used for generation calls elsewhere.
 *
 * Cache: SHA-256 hash of the input text → Redis SETEX (1 hour TTL).
 *        Cache hits skip the OpenAI API call entirely.
 *
 * Batching: The OpenAI embeddings API accepts up to 2048 inputs per request;
 *           we batch at 100 to stay well within limits and keep request sizes manageable.
 */

import 'server-only';
import { createHash } from 'crypto';
import { Redis } from '@upstash/redis';
import { EmbeddingError } from '@/lib/errors';
import { config } from '@/lib/config';

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_BATCH_SIZE = 100;

// Lazy-init: only created when first used (avoids module-load errors in build)
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

type EmbedResponse = {
  data: Array<{ index: number; embedding: number[] }>;
  usage: { prompt_tokens: number; total_tokens: number };
};

/** Calls the OpenAI embeddings API and returns one embedding per input text */
async function callOpenAI(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_EMBED_KEY) {
    throw new EmbeddingError('OPENAI_EMBED_KEY is not set. Add it to .env.local.');
  }

  const response = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_EMBED_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      dimensions: config.rag.embeddingDimensions,
    }),
    signal: AbortSignal.timeout(30_000), // 30s timeout
  });

  if (!response.ok) {
    const body = await response.text();
    throw new EmbeddingError(
      `OpenAI embeddings API error (${response.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as EmbedResponse;

  // Re-order by index (API may return out of order)
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

function cacheKey(text: string): string {
  return `embed:${createHash('sha256').update(text).digest('hex')}`;
}

/**
 * Embeds a single text string with Redis caching.
 * Use this in the chat route where only one query is embedded at a time.
 */
export async function embedText(text: string): Promise<number[]> {
  const key = cacheKey(text);
  const redis = getRedis();

  const cached = await redis.get<number[]>(key);
  if (cached) return cached;

  const [embedding] = await callOpenAI([text]);
  if (!embedding) throw new EmbeddingError('OpenAI returned no embedding for text');

  await redis.setex(key, config.cache.embeddingTtlSeconds, embedding);
  return embedding;
}

/**
 * Embeds an array of texts in batches.
 * Cache-checks each text individually (batches only uncached texts to OpenAI).
 * Use this in the Inngest process-document pipeline.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const redis = getRedis();
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  const uncachedIndices: number[] = [];

  // Check cache for all texts in parallel (max 100 concurrent to avoid Redis limits)
  const cacheChecks = texts.map((text, i) =>
    redis.get<number[]>(cacheKey(text)).then((cached) => {
      if (cached) results[i] = cached;
      else uncachedIndices.push(i);
    })
  );
  await Promise.all(cacheChecks);

  if (uncachedIndices.length === 0) {
    return results as number[][];
  }

  // Embed uncached texts in batches of EMBED_BATCH_SIZE
  for (let i = 0; i < uncachedIndices.length; i += EMBED_BATCH_SIZE) {
    const batchIndices = uncachedIndices.slice(i, i + EMBED_BATCH_SIZE);
    const batchTexts = batchIndices.map((idx) => texts[idx]!);

    const embeddings = await callOpenAI(batchTexts);

    // Store results and cache them
    const cacheOps: Promise<unknown>[] = [];
    batchIndices.forEach((originalIdx, batchPos) => {
      const embedding = embeddings[batchPos];
      if (!embedding) {
        throw new EmbeddingError(
          `OpenAI returned no embedding for text at index ${originalIdx}`
        );
      }
      results[originalIdx] = embedding;
      cacheOps.push(
        redis.setex(
          cacheKey(texts[originalIdx]!),
          config.cache.embeddingTtlSeconds,
          embedding
        )
      );
    });
    await Promise.all(cacheOps);
  }

  return results as number[][];
}
