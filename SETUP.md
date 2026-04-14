# Setup Guide

Zero-to-running in 10 commands. Estimated time: ~15 minutes.

## Prerequisites

- Node.js 20+
- [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
- [Supabase CLI](https://supabase.com/docs/guides/cli): `npm i -g supabase`
- A [Vercel](https://vercel.com) account (free tier works)
- A [Cohere](https://cohere.com) account (free tier: 1,000 rerank calls/month)
- An [OpenAI](https://platform.openai.com) account (for embeddings)
- An [Upstash](https://upstash.com) account (free tier: 10K requests/day)
- An [Inngest](https://inngest.com) account (free tier: 50K runs/month)

---

## Step-by-Step Bootstrap

```bash
# 1. Link to your Vercel project (creates .vercel/project.json)
vercel link --yes

# 2. Add Supabase via Vercel Marketplace (auto-injects SUPABASE_* env vars)
#    Go to: vercel.com/your-team/rag-knowledge-base/integrations
#    Add "Supabase" integration — creates a new Supabase project automatically

# 3. Add Upstash Redis via Vercel Marketplace
#    Go to: vercel.com/your-team/rag-knowledge-base/integrations
#    Add "Upstash" integration — creates Redis database, injects UPSTASH_* env vars

# 4. Pull all env vars to local (provisions VERCEL_OIDC_TOKEN + all integration vars)
vercel env pull .env.local --yes

# 5. Add the remaining secrets that Marketplace doesn't inject:
#    Edit .env.local and fill in:
#      OPENAI_EMBED_KEY=sk-...          (OpenAI key — named specifically for embeddings)
#      COHERE_API_KEY=...               (from dashboard.cohere.com)
#      INNGEST_SIGNING_KEY=signkey-...  (from app.inngest.com → your app → keys)
#      INNGEST_EVENT_KEY=eventkey-...

# 6. Verify no required keys are missing
#    Compare .env.local against .env.local.example:
comm -23 \
  <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.local.example | cut -d '=' -f1 | sort -u) \
  <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.local        | cut -d '=' -f1 | sort -u)
# Must produce empty output before continuing

# 7. Apply all 8 Supabase migrations
npx supabase db push

# 8. (Optional) Seed demo data — requires a Supabase Auth user
#    Create a user in Supabase dashboard → Authentication → Users → Invite user
#    Then update DEMO_USER_ID in supabase/seed.sql and uncomment the DO $$ block
npm run db:seed

# 9. Start Inngest dev server (keep this running in a separate terminal)
npx inngest-cli@latest dev

# 10. Start Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — sign in with Magic Link.

---

## Environment Variables Reference

| Variable | Source | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel ↔ Supabase integration | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel ↔ Supabase integration | Public anon key for client |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel ↔ Supabase integration | Service role — Inngest only |
| `VERCEL_OIDC_TOKEN` | `vercel env pull` | AI Gateway auth (auto-refreshed) |
| `OPENAI_EMBED_KEY` | Manual | OpenAI key for embeddings only |
| `COHERE_API_KEY` | Manual | Cohere Rerank API |
| `INNGEST_SIGNING_KEY` | Manual | Inngest webhook signing |
| `INNGEST_EVENT_KEY` | Manual | Inngest event publishing |
| `UPSTASH_REDIS_REST_URL` | Vercel ↔ Upstash integration | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel ↔ Upstash integration | Upstash Redis token |
| `SENTRY_DSN` | Manual (optional) | Sentry error monitoring |
| `GEMINI_API_KEY` | Manual (optional) | Hero image generation only |

> **Note:** `VERCEL_OIDC_TOKEN` expires after ~24 hours locally. Re-run `vercel env pull .env.local --yes` to refresh it.

---

## Generating Visual Assets

After setup, regenerate all docs screenshots:

```bash
# Install Mermaid CLI (needed once)
npm install -D @mermaid-js/mermaid-cli

# Install Playwright browsers (needed once)
npx playwright install chromium

# Run all generators
npm run generate:all
```

For the AI-generated hero image (`docs/hero.png`), additionally:

```bash
npm install -D @google/genai
GEMINI_API_KEY=your-key npm run generate:hero
```

---

## Deploying to Production

```bash
vercel deploy --prod
```

Zero additional configuration needed — Vercel auto-detects Next.js, injects env vars from integrations, and provisions OIDC tokens for the AI Gateway.

After deploying, verify:

```bash
curl https://your-project.vercel.app/api/health
# Expected: { "status": "ok" }
```
