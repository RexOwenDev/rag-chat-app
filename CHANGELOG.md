# Changelog

All notable changes to KnowledgeBase AI.

---

## [0.5.0] — 2025-04-14

### Phase 5 — Demo Seed + Visuals

**Seed data**
- `supabase/seed.sql` — 1 org, 2 workspaces (HR + Engineering), 8 documents with realistic chunk content, 2 demo conversations with cited messages; guarded against re-seeding
- Workspace members, conversations, and messages isolated in a DO $$ block requiring a real auth user UUID

**Visual generation scripts**
- `scripts/generate-diagrams.ts` — Mermaid CLI (`mmdc`) via `execFile` (no shell injection risk); generates architecture, ingestion sequence, and ER diagram SVGs with dark theme + transparent background
- `scripts/generate-hero.mjs` — Gemini Imagen 4.0 hero image for README
- `docs/mockups/chat.html`, `documents.html`, `analytics.html` — pixel-accurate static HTML mockups using design tokens (`#070d1a` bg, `#00d4ff` accent)
- `scripts/generate-mockups.ts` — Playwright `chromium.launch()`, 1440×900 screenshots of the three mockups

**Documentation**
- `README.md` — hero image, badges, 30-second pitch, before/after table, cost calculation, three inline Mermaid diagrams, feature tiers, security statement, project structure
- `SETUP.md` — 10-command bootstrap with exact prerequisites and env var reference
- `CHANGELOG.md` — this file
- `LICENSE` — MIT
- `vercel.ts` — typed project config with nightly cleanup cron

**package.json scripts**
- `generate:diagrams`, `generate:hero`, `generate:mockups`, `generate:all`
- `db:seed`

---

## [0.4.0] — 2025-04-14

### Phase 4 — Analytics + Export + Eval + Settings

- `lib/analytics/track.ts` — `trackQueryEvent()` + `getAnalytics()` with zero-filled date ranges
- `GET /api/workspaces/[id]/analytics` — 3 parallel queries, Zod-validated date range param
- `components/analytics/` — `kpi-card`, `queries-chart` (Recharts AreaChart), `top-documents-chart` (Recharts BarChart), `analytics-dashboard` (TanStack Query staleTime 30s)
- `lib/pdf/conversation-document.tsx` — @react-pdf/renderer template (`.tsx` for JSX, `createElement` in route)
- `GET /api/workspaces/[id]/conversations/[id]/export` — PDF transcript with chunk→document citation resolution
- `lib/inngest/functions/evaluate-response.ts` — Haiku LLM scorer, 3-step, fire-and-forget from chat `onFinish`
- `lib/chat/history.ts` — `saveMessage` now returns `string | null` (inserted row ID)
- `components/chat/message-bubble.tsx` — eval score badges (green/yellow/red) below completed assistant messages
- `GET/POST /api/workspaces/[id]/members` + `DELETE /api/workspaces/[id]/members/[userId]` — RBAC invite/remove
- `PATCH /api/workspaces/[id]` — system prompt + name editor (owner only)
- `components/settings/settings-form.tsx`, `members-table.tsx` — client components with optimistic updates

---

## [0.3.0] — 2025-04-13

### Phase 3 — RAG Chat

- Hybrid search RPC (`hybrid_search` Postgres function — BM25 + vector + RRF)
- Cohere Rerank 3 integration with graceful fallback to RRF order
- `POST /api/workspaces/[id]/chat` — full pipeline: embed → search → rerank → stream via AI Gateway
- Streaming `ChatInterface` with AI SDK v6 `DefaultChatTransport<UIMessage>`
- `MessageBubble` with inline `[N]` citation parsing → `CitationBadge` HoverCard
- `SourceCitations` sliding panel, `SuggestedQuestions` chips
- `ConversationList` with Supabase Realtime updates
- Conversation persistence (create + load + history)
- Per-user (20/min) + per-IP (100/min) rate limiting on chat route
- `trackQueryEvent` inserts to `query_events` on every response

---

## [0.2.0] — 2025-04-12

### Phase 2 — Document Pipeline

- `lib/rag/extractors/` — pdf-parse, mammoth, cheerio+SSRF guard, plain text
- `lib/rag/chunker.ts` — paragraph-boundary semantic chunker, 400 token max, 50 overlap, heading context
- `lib/rag/embedder.ts` — OpenAI `text-embedding-3-small` with SHA-256 Redis cache (1hr TTL)
- `lib/inngest/functions/process-document.ts` — 4-step Inngest function: extract → chunk → embed → insert
- `POST /api/workspaces/[id]/documents` — RBAC + SSRF + rate limit + Zod validation
- `DELETE /api/workspaces/[id]/documents/[id]` — soft delete (sets `deleted_at`)
- `DocumentManager`, `UploadZone` (optimistic), `DocumentList` (Supabase Realtime)

---

## [0.1.0] — 2025-04-11

### Phase 1 — Foundation

- `create-next-app` with TypeScript strict, Tailwind v4, App Router
- 8 Supabase migrations: organizations, workspaces, documents, chunks (HNSW index), conversations, messages, query_events, hybrid_search function, RLS policies
- Magic Link auth via Supabase + `/api/auth/callback`
- `AppShell` layout: sidebar + top-nav + dark/light mode toggle
- `shadcn/ui` initialized (new-york, slate base)
- `lib/config.ts` — centralized magic numbers
- `lib/errors.ts` — typed error classes
- `src/instrumentation.ts` — Sentry init
- Security headers in `next.config.ts` (CSP, X-Frame-Options, nosniff)
- `vercel.ts` — typed project config
