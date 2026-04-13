import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/health
 *
 * Unauthenticated health check endpoint.
 * Used by uptime monitors (Better Stack, Vercel monitoring, etc.).
 *
 * Returns:
 *   200 { status: 'ok', db: 'ok', ts: string }              — all checks pass
 *   503 { status: 'degraded', db: 'error', ts: string }     — one or more checks failed
 *
 * Intentionally does NOT check Cohere (external — not our SLA) or Redis
 * (non-critical — embeddings just skip the cache on miss).
 */
export async function GET() {
  const ts = new Date().toISOString();

  // DB connectivity check — single lightweight row read, no user data
  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);
    if (error) {
      console.error('[health] DB check failed:', error.message);
      dbStatus = 'error';
    }
  } catch (err) {
    console.error('[health] DB check threw:', err instanceof Error ? err.message : err);
    dbStatus = 'error';
  }

  const healthy = dbStatus === 'ok';

  return NextResponse.json(
    { status: healthy ? 'ok' : 'degraded', db: dbStatus, ts },
    { status: healthy ? 200 : 503 }
  );
}
