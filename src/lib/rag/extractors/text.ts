/**
 * Plain text / Markdown extractor.
 * Validates UTF-8 and normalises whitespace. No dependencies needed.
 */

import 'server-only';
import { ExtractionError } from '@/lib/errors';

export interface TextExtractResult {
  text: string;
  pageCount: null;
}

/**
 * Extracts text from a plain-text or Markdown buffer.
 * Returns the content with normalised line endings and whitespace.
 */
export function extractText(buffer: Buffer): TextExtractResult {
  if (!buffer || buffer.length === 0) {
    throw new ExtractionError('Text buffer is empty', 'txt');
  }

  let text: string;
  try {
    // Strict UTF-8 decoding — rejects invalid byte sequences
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Fall back to replacement-character mode for files with encoding issues
    text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    console.warn('[text-extractor] Buffer contained non-UTF-8 bytes; replaced with replacement characters.');
  }

  // Normalise line endings and collapse excessive whitespace
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) {
    throw new ExtractionError('Text file is empty after whitespace normalisation', 'txt');
  }

  return { text, pageCount: null };
}
