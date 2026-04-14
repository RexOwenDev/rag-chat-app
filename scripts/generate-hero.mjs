/**
 * scripts/generate-hero.mjs
 *
 * Generates the README hero image using Google Gemini Imagen.
 *
 * Prerequisites:
 *   npm install -D @google/genai
 *   export GEMINI_API_KEY=your-key
 *   (key is at: https://aistudio.google.com/app/apikey)
 *
 * Usage:
 *   node scripts/generate-hero.mjs
 *   npm run generate:hero
 *
 * Output: docs/hero.png
 */

import { GoogleGenAI } from '@google/genai';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '..', 'docs');

mkdirSync(DOCS_DIR, { recursive: true });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Error: GEMINI_API_KEY environment variable is required.');
  console.error('Get your key at https://aistudio.google.com/app/apikey');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

console.log('Generating hero image with Gemini Imagen 4.0...');

const PROMPT = [
  'Enterprise AI knowledge base application UI.',
  'Dark navy background #070d1a with subtle blueprint grid lines.',
  'Electric cyan accent color #00d4ff glowing effects.',
  'Split-screen composition: left side shows a clean chat conversation with',
  'numbered citation badges [1] [2] [3] rendered in glowing cyan.',
  'Right panel shows source document cards with confidence percentage bars',
  'showing 94% and 87%, document titles in white text.',
  'Glassmorphism card style with frosted dark surfaces.',
  'Professional enterprise software aesthetic, minimal and clean.',
  'No text overlays, no logos, no watermarks.',
  '16:9 cinematic aspect ratio. Photorealistic UI render.',
].join(' ');

const result = await ai.models.generateImages({
  model: 'imagen-4.0-generate-001',
  prompt: PROMPT,
  config: {
    numberOfImages: 1,
    aspectRatio: '16:9',
  },
});

const imageBytes = result.generatedImages[0]?.image?.imageBytes;
if (!imageBytes) {
  console.error('No image bytes returned. Response:', JSON.stringify(result, null, 2));
  process.exit(1);
}

const outputPath = join(DOCS_DIR, 'hero.png');
writeFileSync(outputPath, Buffer.from(imageBytes, 'base64'));
console.log(`✓ Generated ${outputPath}`);
