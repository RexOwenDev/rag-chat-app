/**
 * DOCX text extractor — uses mammoth.
 * Converts Word documents to plain text while preserving heading structure
 * (headings are emitted as "# Heading text" so the semantic chunker can
 * detect them and set heading_context correctly).
 */

import 'server-only';
import mammoth from 'mammoth';
import { load as cheerioLoad } from 'cheerio';
import { ExtractionError } from '@/lib/errors';

export interface DocxExtractResult {
  text: string;
  pageCount: null; // DOCX has no concept of page count without rendering
}

/**
 * Extracts structured text from a DOCX buffer.
 * Headings become markdown-style `# ` prefixed lines for the chunker.
 * Throws ExtractionError on failure.
 */
export async function extractDocx(buffer: Buffer): Promise<DocxExtractResult> {
  if (!buffer || buffer.length === 0) {
    throw new ExtractionError('DOCX buffer is empty', 'docx');
  }

  try {
    // Convert to HTML — mammoth preserves heading styles this way
    const { value: html, messages } = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh",
          // Handle numbered heading styles
          "p[style-name='heading 1'] => h1:fresh",
          "p[style-name='heading 2'] => h2:fresh",
          "p[style-name='heading 3'] => h3:fresh",
        ],
      }
    );

    // Log mammoth warnings (e.g. unsupported shapes) but don't throw
    const warnings = messages.filter((m) => m.type === 'warning');
    if (warnings.length > 0) {
      console.warn('[docx-extractor] Mammoth warnings:', warnings.map((m) => m.message));
    }

    // Parse HTML and convert to structured plain text
    const $ = cheerioLoad(html);
    const lines: string[] = [];

    $('body *').filter((_, el) => {
      // Only process direct block-level elements to avoid double-counting nested content
      const parent = $(el).parent();
      const parentTag = (parent[0] as unknown as Element)?.tagName?.toLowerCase() ?? '';
      return ['body', 'div'].includes(parentTag);
    });

    // Iterate body children, converting headings to markdown markers
    $('body').children().each((_, el) => {
      const tag = (el as unknown as Element).tagName?.toLowerCase() ?? '';
      const text = $(el).text().trim();
      if (!text) return;

      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const level = parseInt(tag.slice(1), 10);
        lines.push('#'.repeat(level) + ' ' + text);
      } else if (tag === 'li') {
        lines.push('- ' + text);
      } else {
        lines.push(text);
      }
    });

    const text = lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

    if (!text) {
      throw new ExtractionError(
        'No text could be extracted from this DOCX. The document may be empty.',
        'docx'
      );
    }

    return { text, pageCount: null };
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError(
      `DOCX parse failed: ${err instanceof Error ? err.message : String(err)}`,
      'docx'
    );
  }
}
