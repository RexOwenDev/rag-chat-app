// vercel.ts — typed Vercel project config (replaces vercel.json in Next.js 16)
// @vercel/config ships a vulnerable path-to-regexp transitive dep; inline type instead.

interface CronJob {
  path: string;
  schedule: string;
}

interface VercelProjectConfig {
  framework?: string;
  buildCommand?: string;
  crons?: CronJob[];
}

export const config: VercelProjectConfig = {
  framework: 'nextjs',
  crons: [
    // Nightly soft-delete cleanup: permanently purge docs deleted >30 days ago
    { path: '/api/cron/cleanup', schedule: '0 2 * * *' },
  ],
};
