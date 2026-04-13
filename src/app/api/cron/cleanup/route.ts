import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { config } from '@/lib/config';

/**
 * GET /api/cron/cleanup
 *
 * Nightly soft-delete cleanup job — permanently removes documents (and their
 * chunks via CASCADE) that have been soft-deleted for longer than
 * config.softDelete.purgeAfterDays days.
 *
 * Scheduled in vercel.ts: cron "0 2 * * *" (02:00 UTC daily)
 *
 * Authentication: Vercel injects "Authorization: Bearer {CRON_SECRET}" on
 * cron invocations. We verify this before touching the database.
 * Set CRON_SECRET in Vercel env vars: `openssl rand -hex 32`
 */
export async function GET(request: Request) {
  // Authenticate — reject any request that isn't from Vercel's cron scheduler
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.softDelete.purgeAfterDays);

  const supabase = getServiceClient();

  try {
    // Hard-delete documents soft-deleted before the cutoff date.
    // chunks are removed automatically via ON DELETE CASCADE.
    // Supabase Storage files are NOT removed here — use a separate
    // storage lifecycle rule or extend this function with storage.remove().
    const { data, error } = await supabase
      .from('documents')
      .delete()
      .lt('deleted_at', cutoff.toISOString())
      .not('deleted_at', 'is', null)
      .select('id');

    if (error) {
      console.error('[cron/cleanup] DB delete failed:', error.message);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    const purgedCount = data?.length ?? 0;
    console.log(`[cron/cleanup] Purged ${purgedCount} documents soft-deleted before ${cutoff.toISOString()}`);

    return NextResponse.json({
      ok: true,
      purged: purgedCount,
      cutoff: cutoff.toISOString(),
    });
  } catch (err) {
    console.error('[cron/cleanup] Unexpected error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
