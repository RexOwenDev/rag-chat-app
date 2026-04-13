/**
 * PDF text extractor — uses pdf-parse v2 (class-based API).
 * Server-only: never import from client components.
 */

import 'server-only';
import { PDFParse } from 'pdf-parse';
import { ExtractionError } from '@/lib/errors';

export interface PdfExtractResult {
  text: string;
  pageCount: number;
}

/**
 * Extracts plain text from a PDF buffer.
 * Throws ExtractionError on parse failure.
 */
export async function extractPdf(buffer: Buffer): Promise<PdfExtractResult> {
  if (!buffer || buffer.length === 0) {
    throw new ExtractionError('PDF buffer is empty', 'pdf');
  }

  // pdf-parse v2 requires a Uint8Array; Buffer is a subclass, but explicit
  // conversion avoids the v2 worker thread ownership transfer warning.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();

    const text = result.text
      .replace(/\r\n/g, '\n')   // normalise line endings
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // collapse excessive blank lines
      .trim();

    if (!text) {
      throw new ExtractionError(
        'No text could be extracted from this PDF. It may be a scanned image-only document.',
        'pdf'
      );
    }

    // result.total is the page count from pdf-parse v2 (TextResult.total)
    return { text, pageCount: result.total };
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError(
      `PDF parse failed: ${err instanceof Error ? err.message : String(err)}`,
      'pdf'
    );
  } finally {
    await parser.destroy();
  }
}
