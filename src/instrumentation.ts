/**
 * Next.js instrumentation hook — runs once at server startup, before any requests.
 * Used to initialize Sentry error monitoring.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only load Sentry in Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // Sample 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,

      // Distinguish environments in Sentry UI
      environment: process.env.VERCEL_ENV ?? 'development',

      // Disable in local dev unless DSN is explicitly set
      enabled: Boolean(process.env.SENTRY_DSN),

      // Ignore common non-actionable browser errors that get forwarded
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
      ],
    });
  }
}

/**
 * Captures unhandled errors from async Server Components and Route Handlers.
 * Called by Next.js when an error escapes a component's error boundary.
 */
export const onRequestError = async (
  err: Error & { digest?: string },
  _request: { path: string; method: string },
  _context: { routerKind: string; routePath: string; routeType: string }
) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');
    // captureException is the universal error capture method
    Sentry.captureException(err);
  }
};
