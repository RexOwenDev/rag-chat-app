import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

// In development, Next.js HMR requires the CSP directive that allows dynamic
// code execution. In production this directive is omitted — compiled output
// does not need it, and its presence widens the XSS attack surface.
const devOnlyScriptDirectives = isDev ? " 'unsafe-eval'" : '';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${devOnlyScriptDirectives}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.shields.io",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.cohere.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16 — no explicit opt-in needed
  // React Compiler: auto-memoizes components (same as Proposal Studio)
  reactCompiler: true,
  // Partial Prerendering: mix static + dynamic + cached content per route
  cacheComponents: true,
  // Arrow fn avoids ambiguity with next/headers runtime import
  headers: () =>
    Promise.resolve([
      {
        source: '/(.*)', // all routes including API and static files
        headers: securityHeaders,
      },
    ]),
  images: {
    // Supabase Storage URLs for document thumbnails (if added later)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
