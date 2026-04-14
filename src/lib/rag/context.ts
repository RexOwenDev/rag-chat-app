/**
 * Builds the numbered context block injected into the Claude system prompt.
 *
 * Each reranked chunk becomes a numbered citation `[N]`. The same numbers
 * appear inline in Claude's response (e.g., "Per company policy [1]...") and
 * are parsed client-side into citation cards.
 *
 * Security: chunk content is sanitized to prevent prompt injection before
 * being inserted into the system prompt.
 */

import type { RerankResult, MessageCitation } from '@/lib/types';
import { config } from '@/lib/config';

/** Strips common prompt injection trigger phrases from chunk content */
function sanitize(text: string): string {
  return text
    .replace(/ignore\s+all\s+(previous|prior|above)\s+instructions?/gi, '[redacted]')
    .replace(/you\s+are\s+now\s+(a|an)\s+/gi, '[redacted]')
    .replace(/disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, '[redacted]')
    .replace(/forget\s+(everything|all)\s+(you\s+)?(know|were\s+told)/gi, '[redacted]')
    .trim();
}

/**
 * Converts reranked chunks into a formatted context block for the Claude prompt.
 * Returns both the plain-text context string and the structured citation metadata.
 */
export function buildContext(chunks: RerankResult[]): {
  contextBlock: string;
  citations: MessageCitation[];
} {
  const citations: MessageCitation[] = chunks.map((chunk, i) => ({
    index: i + 1,
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    excerpt: sanitize(chunk.content).slice(0, 300),
    sourceType: chunk.sourceType,
    sourceUrl: chunk.sourceUrl,
    pageNumber: chunk.pageNumber,
  }));

  const parts = chunks.map((chunk, i) => {
    const citation = citations[i]!;
    const confidence = Math.round(chunk.relevanceScore * 100);
    const location = chunk.pageNumber ? `, page ${chunk.pageNumber}` : '';
    const heading = chunk.headingContext ? ` — ${chunk.headingContext}` : '';

    const header = `[${i + 1}] Source: "${citation.documentTitle}"${heading}${location} (confidence: ${confidence}%)`;
    const body = sanitize(chunk.content);

    return `${header}\n${body}`;
  });

  let contextBlock = parts.join('\n\n---\n\n');

  // Hard cap: if context is too long, truncate to first 3 chunks only
  if (contextBlock.length > config.rag.maxContextChars) {
    console.warn(
      `[context] Context block (${contextBlock.length} chars) exceeds maxContextChars — truncating to first 3 chunks`
    );
    const truncatedParts = parts.slice(0, 3);
    contextBlock = truncatedParts.join('\n\n---\n\n');
  }

  return { contextBlock, citations };
}
