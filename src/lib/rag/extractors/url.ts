/**
 * URL text extractor — fetches a web page and extracts its main content.
 * Protected against SSRF via DNS-based IP range validation.
 */

import 'server-only';
import { load as cheerioLoad } from 'cheerio';
import { assertSafeURL } from './ssrf';
import { ExtractionError } from '@/lib/errors';

export interface UrlExtractResult {
  text: string;
  pageCount: null;
  resolvedTitle: string | null;
}

const USER_AGENT = 'KnowledgeBase-AI/1.0 (+https://github.com/owenq/rag-knowledge-base)';

// Tags whose content we strip entirely before text extraction
const NOISE_SELECTORS = [
  'script', 'style', 'noscript', 'iframe',
  'nav', 'footer', 'header', 'aside',
  '.nav', '.navigation', '.menu', '.sidebar', '.footer', '.header',
  '#nav', '#navigation', '#menu', '#sidebar', '#footer', '#header',
  '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  '[aria-hidden="true"]',
  '.cookie-banner', '.cookie-notice', '.gdpr', '.popup', '.modal',
  '.ad', '.advertisement', '.social-share', '.breadcrumb',
].join(', ');

// Candidate selectors for the main article content, tried in order
const CONTENT_SELECTORS = [
  'article',
  '[role="main"]',
  'main',
  '.content',
  '.post-content',
  '.article-content',
  '.entry-content',
  '.page-content',
  '#content',
  '#main',
  '#main-content',
];

/**
 * Fetches a URL and extracts clean article text.
 * Throws ExtractionError if the URL is unsafe or fetch fails.
 */
export async function extractUrl(url: string): Promise<UrlExtractResult> {
  // SSRF guard — throws if the URL resolves to a private IP
  await assertSafeURL(url);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15_000), // 15-second timeout
      redirect: 'follow',
    });
  } catch (err) {
    throw new ExtractionError(
      `Failed to fetch URL "${url}": ${err instanceof Error ? err.message : String(err)}`,
      'url'
    );
  }

  if (!response.ok) {
    throw new ExtractionError(
      `URL "${url}" returned HTTP ${response.status} ${response.statusText}`,
      'url'
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new ExtractionError(
      `URL "${url}" returned non-HTML content (${contentType}). Only HTML pages are supported.`,
      'url'
    );
  }

  const html = await response.text();
  const $ = cheerioLoad(html);

  // Extract page title before stripping
  const resolvedTitle = $('title').first().text().trim() || null;

  // Strip noise elements
  $(NOISE_SELECTORS).remove();

  // Remove hidden elements
  $('[style*="display:none"], [style*="display: none"], [hidden]').remove();

  // Try content selectors in priority order; fall back to body
  let $content = $('body');
  for (const selector of CONTENT_SELECTORS) {
    const $candidate = $(selector).first();
    if ($candidate.length && $candidate.text().trim().length > 200) {
      $content = $candidate;
      break;
    }
  }

  // Extract text preserving paragraph structure
  // Convert block elements to paragraph markers for the chunker
  $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as unknown as Element).tagName?.toLowerCase() ?? '';
    const level = parseInt(tag.slice(1), 10);
    const $el = $(el);
    $el.replaceWith(`\n\n${'#'.repeat(level)} ${$el.text().trim()}\n\n`);
  });

  $content.find('p, li, blockquote, td, th').each((_, el) => {
    const $el = $(el);
    $el.replaceWith(`\n\n${$el.text().trim()}\n\n`);
  });

  const rawText = $content.text();
  const text = rawText
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  if (text.length < 50) {
    throw new ExtractionError(
      `URL "${url}" yielded very little text content (${text.length} chars). The page may require JavaScript rendering.`,
      'url'
    );
  }

  return { text, pageCount: null, resolvedTitle };
}
