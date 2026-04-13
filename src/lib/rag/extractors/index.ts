/**
 * Extractor dispatcher — routes to the correct extractor by source_type.
 * All extractors are server-only.
 */

import 'server-only';
import type { DocumentSourceType } from '@/lib/types';
import { ExtractionError } from '@/lib/errors';
import { extractPdf, type PdfExtractResult } from './pdf';
import { extractDocx, type DocxExtractResult } from './docx';
import { extractUrl, type UrlExtractResult } from './url';
import { extractText, type TextExtractResult } from './text';

/** Base result shape shared across all extractors */
export interface ExtractResult {
  text: string;
  pageCount: number | null;
  resolvedTitle?: string | null;
}

type FileInput = {
  sourceType: Extract<DocumentSourceType, 'pdf' | 'docx' | 'txt' | 'md'>;
  buffer: Buffer;
};

type UrlInput = {
  sourceType: Extract<DocumentSourceType, 'url'>;
  sourceUrl: string;
};

export type ExtractInput = FileInput | UrlInput;

/**
 * Dispatches to the appropriate extractor for the given source type.
 * All extractors throw ExtractionError on failure.
 */
export async function extractContent(input: ExtractInput): Promise<ExtractResult> {
  switch (input.sourceType) {
    case 'pdf': {
      const result: PdfExtractResult = await extractPdf(input.buffer);
      return { text: result.text, pageCount: result.pageCount };
    }
    case 'docx': {
      const result: DocxExtractResult = await extractDocx(input.buffer);
      return { text: result.text, pageCount: result.pageCount };
    }
    case 'txt':
    case 'md': {
      const result: TextExtractResult = extractText(input.buffer);
      return { text: result.text, pageCount: result.pageCount };
    }
    case 'url': {
      const result: UrlExtractResult = await extractUrl(input.sourceUrl);
      return {
        text: result.text,
        pageCount: result.pageCount,
        resolvedTitle: result.resolvedTitle,
      };
    }
    default: {
      // Exhaustive check — TypeScript will catch missing cases at compile time
      const exhaustiveCheck: never = input;
      throw new ExtractionError(
        `Unknown source type: ${(exhaustiveCheck as { sourceType: string }).sourceType}`,
        'unknown'
      );
    }
  }
}
