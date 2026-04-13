/**
 * Semantic chunker — splits text into embedding-ready chunks.
 *
 * Strategy:
 *   1. Split on paragraph boundaries (double newlines)
 *   2. Detect headings and carry them as heading_context for subsequent chunks
 *   3. Merge paragraphs up to chunkMaxTokens; split oversized paragraphs by sentence
 *   4. Apply chunkOverlap tokens of overlap between adjacent chunks for continuity
 *
 * Token estimation: 1 token ≈ 4 characters (standard OpenAI approximation for English).
 * Accurate to ±10% — sufficient for keeping chunks well within the 8192-token model limit.
 */

import { config } from '@/lib/config';

export interface SemanticChunk {
  content: string;
  heading_context: string | null;
  chunk_index: number;
  token_count: number;
  page_number: number | null;
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function tokensToChars(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}

/**
 * Returns the last N token-equivalents of `text` for overlap.
 * Tries to break on a sentence boundary to preserve readability.
 */
function getOverlapSlice(text: string, overlapTokens: number): string {
  const overlapChars = tokensToChars(overlapTokens);
  if (text.length <= overlapChars) return text;

  const slice = text.slice(-overlapChars);
  // Try to start at a sentence boundary within the slice
  const sentenceStart = slice.search(/(?<=[.!?])\s+[A-Z]/);
  return sentenceStart > 0 ? slice.slice(sentenceStart).trimStart() : slice;
}

/**
 * Splits a long paragraph into sentence-sized pieces.
 * Sentences end at `.`, `!`, `?` followed by whitespace and a capital letter,
 * or at the end of the string.
 */
function splitBySentences(text: string): string[] {
  // Match sentence boundaries: period/!/?  followed by optional closing punct,
  // whitespace, then a capital letter or end of string
  const parts = text.split(/(?<=[.!?]["'»\s])\s+(?=[A-Z])/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/**
 * Detects if a line is a heading. Returns the heading text, or null.
 * Matches:
 *   - Markdown headings:  "## My Section"
 *   - ALL CAPS short lines: "CHAPTER 3: INTRODUCTION" (≤ 80 chars)
 */
function detectHeading(line: string): string | null {
  // Markdown heading
  const mdMatch = line.match(/^#{1,6}\s+(.+)$/);
  if (mdMatch) return mdMatch[1]!.trim();

  // ALL CAPS line (heading-like in PDFs/plain text)
  if (
    line.length > 0 &&
    line.length <= 80 &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) // must contain at least one letter
  ) {
    return line.trim();
  }

  return null;
}

function makeChunk(
  content: string,
  headingContext: string | null,
  index: number,
  pageNumber: number | null
): SemanticChunk {
  return {
    content: content.trim(),
    heading_context: headingContext,
    chunk_index: index,
    token_count: estimateTokens(content),
    page_number: pageNumber,
  };
}

/**
 * Splits extracted text into semantic chunks ready for embedding.
 *
 * @param text       Full extracted text (may include markdown heading markers)
 * @param pageNumber Page number to attach to all chunks (for PDF page tracking)
 */
export function semanticChunk(
  text: string,
  pageNumber: number | null = null
): SemanticChunk[] {
  const maxTokens = config.rag.chunkMaxTokens;   // 400
  const overlapTokens = config.rag.chunkOverlap; // 50
  const maxChars = tokensToChars(maxTokens);

  const chunks: SemanticChunk[] = [];
  let chunkIndex = 0;
  let currentHeading: string | null = null;
  let currentChunk = '';
  let overlapCarry = '';

  // Split text into paragraphs on double (or more) newlines
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  const flush = () => {
    if (!currentChunk.trim()) return;
    chunks.push(makeChunk(currentChunk, currentHeading, chunkIndex++, pageNumber));
    overlapCarry = getOverlapSlice(currentChunk, overlapTokens);
    currentChunk = '';
  };

  for (const para of paragraphs) {
    // Detect and update heading context
    const detectedHeading = detectHeading(para);
    if (detectedHeading) {
      flush();
      currentHeading = detectedHeading;
      overlapCarry = ''; // headings reset overlap — new section = fresh context
      continue;
    }

    // Decide how to start the next chunk
    const base = overlapCarry
      ? `${overlapCarry}\n\n${para}`
      : currentChunk
        ? `${currentChunk}\n\n${para}`
        : para;

    if (estimateTokens(base) <= maxTokens) {
      // Paragraph fits — accumulate
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${para}`
        : overlapCarry
          ? `${overlapCarry}\n\n${para}`
          : para;
      overlapCarry = '';
    } else if (estimateTokens(para) > maxTokens) {
      // Paragraph itself exceeds limit — flush current and split by sentences
      flush();

      const sentences = splitBySentences(para);
      for (const sentence of sentences) {
        const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

        if (estimateTokens(candidate) <= maxTokens) {
          currentChunk = candidate;
        } else {
          flush();
          // Single sentence too long — hard-truncate to maxChars
          currentChunk = sentence.length > maxChars
            ? sentence.slice(0, maxChars)
            : sentence;
        }
      }
    } else {
      // Current chunk is full — flush and start fresh
      flush();
      currentChunk = overlapCarry ? `${overlapCarry}\n\n${para}` : para;
      overlapCarry = '';
    }
  }

  // Flush any remaining content
  flush();

  return chunks;
}
