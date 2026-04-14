/**
 * scripts/generate-mockups.ts
 *
 * Screenshots the three static HTML mockups at 1440×900 using Playwright.
 * No running Next.js app or API keys required.
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Usage:
 *   npx ts-node scripts/generate-mockups.ts
 *   npm run generate:mockups
 *
 * Output:
 *   docs/chat-interface.png
 *   docs/document-manager.png
 *   docs/analytics-dashboard.png
 */

import { chromium } from 'playwright';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { mkdirSync } from 'fs';

const DOCS_DIR = resolve(process.cwd(), 'docs');
mkdirSync(DOCS_DIR, { recursive: true });

interface Mockup {
  html: string;
  out: string;
  label: string;
}

const mockups: Mockup[] = [
  {
    html: resolve(process.cwd(), 'docs/mockups/chat.html'),
    out: resolve(DOCS_DIR, 'chat-interface.png'),
    label: 'Chat Interface',
  },
  {
    html: resolve(process.cwd(), 'docs/mockups/documents.html'),
    out: resolve(DOCS_DIR, 'document-manager.png'),
    label: 'Document Manager',
  },
  {
    html: resolve(process.cwd(), 'docs/mockups/analytics.html'),
    out: resolve(DOCS_DIR, 'analytics-dashboard.png'),
    label: 'Analytics Dashboard',
  },
];

async function main(): Promise<void> {
  console.log(`Screenshotting ${mockups.length} mockups at 1440×900…\n`);

  const browser = await chromium.launch();

  for (const mockup of mockups) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(mockup.html).href);
    // Let CSS animations and fonts settle before capturing
    await page.waitForTimeout(400);
    await page.screenshot({ path: mockup.out });
    await page.close();
    console.log(`✓ ${mockup.label} → ${mockup.out}`);
  }

  await browser.close();
  console.log('\nAll screenshots generated successfully.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
