# Contributing to KnowledgeBase AI

Thank you for your interest. This is a portfolio project — contributions are welcome for bug fixes, documentation improvements, and educational enhancements.

## Before You Start

This project requires you to provision your own infrastructure. There is no shared development environment. See [SETUP.md](./SETUP.md) for the full bootstrap flow.

Required accounts and services:
- Supabase (free tier sufficient for development)
- Vercel (free tier, for OIDC token provisioning)
- OpenAI API key (embeddings only — `text-embedding-3-small`)
- Cohere API key (reranking — free tier: 1,000 calls/month)
- Inngest (free tier, for background job dev server)
- Upstash Redis (free tier)

## Development Setup

```bash
# 1. Fork and clone
git clone https://github.com/your-username/rag-knowledge-base
cd rag-knowledge-base

# 2. Install dependencies
npm install
npx playwright install chromium

# 3. Bootstrap infrastructure (see SETUP.md for full detail)
vercel link
vercel env pull .env.local

# 4. Run database migrations
npx supabase db push

# 5. Start background job server (separate terminal)
npx inngest-cli@latest dev

# 6. Start Next.js dev server
npm run dev
```

## Code Standards

All contributions must pass these checks before review:

```bash
npx tsc --noEmit       # Zero TypeScript errors
npx eslint src/        # Zero ESLint violations
```

Key conventions enforced:
- All magic numbers reference `src/lib/config.ts` — no inline numeric constants
- All typed errors use classes from `src/lib/errors.ts`
- All Zod validation schemas live in `src/lib/validation/`
- `src/lib/supabase/service.ts` is the only file that imports `SUPABASE_SERVICE_ROLE_KEY`
- No `console.log` of user data, tokens, or API responses — `console.error` for errors only
- Every data-dependent view must have a loading skeleton and empty state

## What We Accept

**Good candidates:**
- Bug fixes with a clear reproduction case
- Documentation improvements or corrections
- Test coverage additions
- Performance improvements with measured benchmarks
- Accessibility improvements to UI components

**Out of scope:**
- New AI providers (adding Bedrock, Vertex, etc. as alternatives)
- Alternative database backends (the Supabase + pgvector choice is intentional)
- UI theme changes or alternative design systems
- Feature additions that weren't part of the original architecture

If you're unsure whether something is in scope, open an issue first.

## Pull Request Process

1. Branch from `main` — use `feat/`, `fix/`, or `docs/` prefixes
2. Keep PRs focused — one concern per PR
3. Run `npx tsc --noEmit` and `npx eslint src/` before pushing
4. Write a clear PR description: what changed and why
5. Reference any related issues with `Closes #N`

## Reporting Issues

Use GitHub Issues. Include:
- Your Node.js version (`node --version`)
- Your OS
- Exact error message and stack trace
- Steps to reproduce
- What you expected vs. what happened

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
