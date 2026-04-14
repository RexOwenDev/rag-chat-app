# KnowledgeBase AI

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E)
![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-7C3AED)
![Cohere](https://img.shields.io/badge/Cohere-Rerank_3-FF6B6B)
![Inngest](https://img.shields.io/badge/Inngest-background_jobs-orange)
![License](https://img.shields.io/badge/license-MIT-green)

> Your team spends hours searching SharePoint, Notion, and email threads for answers that already exist in your documents.
>
> **KnowledgeBase AI gives every employee instant, cited answers from your internal knowledge — in under 2 seconds, with full audit trail, and zero data leaving your infrastructure.**

---

## What It Does

| | Before | After |
|---|---|---|
| Find a policy answer | 15–30 min search + email thread | 2 seconds, cited answer |
| Onboard a new hire | 40 hrs reading docs + Q&A | Day-1 chat access to all documents |
| Repeated questions | Same question, different person, every week | Self-serve, zero repeat tickets |
| Compliance audit | Manual document trail | Exported conversation + citation log |

**Cost:** ~$0.003/query × 300 queries/day = **$0.90/day** ($27/month) — vs. 75 hrs/week of recovered search time at $50/hr blended rate.

---

## Screenshots

| Chat with Citations | Document Manager | Analytics Dashboard |
|---|---|---|
| ![Chat](docs/chat-interface.png) | ![Documents](docs/document-manager.png) | ![Analytics](docs/analytics-dashboard.png) |

---

## Architecture

```mermaid
flowchart TD
  subgraph Ingestion["Ingestion Pipeline"]
    A[Upload PDF / DOCX / URL] --> B[Supabase Storage]
    B --> C[Inngest Step Function]
    C --> D[Extract Text]
    D --> E[Semantic Chunker\n400 token max]
    E --> F[OpenAI Embeddings\ntext-embedding-3-small]
    F --> G[(pgvector · chunks)]
    G --> H[status: ready]
  end

  subgraph Query["RAG Query Pipeline"]
    I[User Question] --> J[Embed Query\nRedis cache]
    J --> K[Hybrid Search RPC\nBM25 + Vector + RRF]
    K --> L[Top 20 Candidates]
    L --> M[Cohere Rerank 3\nCross-encoder]
    M --> N[Top 5 Chunks]
    N --> O[Claude via AI Gateway\nclaude-sonnet-4.6]
    O --> P[Streaming + Citations]
  end

  G -.->|hybrid_search RPC| K
```

---

## Ingestion Pipeline

```mermaid
sequenceDiagram
  actor User
  participant UI as Next.js UI
  participant API as API Route
  participant Stor as Supabase Storage
  participant DB as Supabase DB
  participant Inn as Inngest
  participant OAI as OpenAI

  User->>UI: Drop PDF / paste URL
  UI->>API: POST /api/workspaces/{id}/documents
  API->>Stor: Upload file
  API->>DB: INSERT (status: pending)
  API->>Inn: Send document/process event
  API-->>UI: 200 { document }

  Inn->>Inn: Step 1 — extract-text
  Inn->>Inn: Step 2 — chunk-text (400 token max)
  Inn->>OAI: Batch embed chunks
  OAI-->>Inn: float32[1536] per chunk
  Inn->>DB: INSERT chunks + UPDATE status: ready
  DB-->>UI: Realtime update
```

---

## Database Schema

```mermaid
erDiagram
  organizations ||--o{ workspaces : "has"
  workspaces ||--o{ workspace_members : "has"
  workspaces ||--o{ documents : "contains"
  workspaces ||--o{ conversations : "has"
  documents ||--o{ chunks : "split into"
  conversations ||--o{ messages : "has"

  chunks {
    uuid id PK
    uuid document_id FK
    vector_1536 embedding
    tsvector fts
    text content
    text heading_context
  }

  messages {
    uuid id PK
    text content
    uuid_array cited_chunk_ids
    numeric faithfulness_score
    numeric relevance_score
  }
```

---

## What Makes This Enterprise-Level

### Tier 1 — Search Quality
- **Hybrid BM25 + vector search** with Reciprocal Rank Fusion — catches both semantic and keyword matches that either alone would miss
- **Cross-encoder reranking** (Cohere Rerank 3) — re-orders top 20 candidates by true semantic relevance, not just cosine distance
- **Semantic chunking** — paragraph-boundary aware, 400 token max, preserves `heading_context` for each chunk

### Tier 2 — User Experience
- **Streaming with inline citation badges** — `[1]`, `[2]` appear as content streams; HoverCard shows source + page + confidence %
- **Real-time document processing** — `pending → processing → ready` via Supabase Realtime
- **Async RAG evaluation** — faithfulness + relevance scores shown below each assistant response (Claude Haiku, fire-and-forget via Inngest)
- **Conversation export to PDF** — audit trail with cited document names per message (`@react-pdf/renderer`)

### Tier 3 — Enterprise Credibility
- **Multi-tenant workspaces** — Supabase RLS enforces tenant isolation at the database layer; workspaces cannot read each other's data
- **RBAC** — owner / editor / viewer roles per workspace; checked on every API route
- **Workspace system prompt** — owners customize the assistant persona per workspace
- **Analytics dashboard** — queries/day chart, top cited documents, avg latency, 7-day cost (Recharts + TanStack Query)
- **Soft deletes** — documents are never hard-deleted; 30-day purge via Inngest nightly cron

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router + React 19 + TypeScript strict |
| Styling | Tailwind v4 + shadcn/ui (new-york) |
| AI Generation | Claude `claude-sonnet-4.6` via Vercel AI Gateway (OIDC auth) |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) — direct fetch, Redis-cached |
| Reranking | Cohere Rerank 3 — cross-encoder, graceful fallback to RRF order |
| Database | Supabase PostgreSQL + pgvector (HNSW index, m=16) |
| File Storage | Supabase Storage |
| Background Jobs | Inngest v4 step functions (retries, concurrency control) |
| Rate Limiting | Upstash Redis + `@upstash/ratelimit` (sliding window) |
| Charts | Recharts + TanStack Query |
| PDF Export | `@react-pdf/renderer` v4 |
| Error Monitoring | Sentry (`src/instrumentation.ts`) |

---

## Security & Privacy

- **Your data stays in your infrastructure** — documents stored in Supabase (your account, your region)
- **Zero training on your data** — Claude API contract prohibits using API calls for model training
- **Row-Level Security** — database-enforced tenant isolation at the Postgres layer
- **RBAC** — owner / editor / viewer roles per workspace, enforced on every mutation
- **Audit log** — every query logged with user ID, timestamp, latency, and token cost in `query_events`
- **SSRF protection** — URL ingestion blocks private IP ranges (`169.254.x.x`, `10.x.x.x`, etc.) via `ssrf-req-filter`
- **Prompt injection defense** — chunk content sanitized before insertion into Claude's context window
- **Rate limiting** — 20 chat requests/user/min + 10 uploads/user/10min with `Retry-After` headers

---

## Quick Start

See [SETUP.md](SETUP.md) for the complete 10-command bootstrap.

```bash
git clone https://github.com/your-username/rag-knowledge-base
cd rag-knowledge-base
vercel link && vercel env pull .env.local
npx supabase db push
npm run db:seed
npm run dev
```

---

## Generating Visual Assets

All documentation visuals are reproducible from source:

```bash
npm run generate:all
# Outputs:
#   docs/architecture.svg        (Mermaid CLI, dark theme)
#   docs/ingestion.svg
#   docs/schema.svg
#   docs/hero.png                (Gemini Imagen 4.0 — requires GEMINI_API_KEY)
#   docs/chat-interface.png      (Playwright screenshot)
#   docs/document-manager.png
#   docs/analytics-dashboard.png
```

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/                 # Magic Link auth
│   ├── (app)/workspaces/[id]/
│   │   ├── chat/                     # RAG chat interface
│   │   ├── documents/                # Document manager + Realtime status
│   │   ├── analytics/                # Usage analytics dashboard
│   │   └── settings/                 # Workspace settings + member management
│   └── api/workspaces/[id]/
│       ├── chat/                     # Streaming RAG endpoint
│       ├── documents/                # Upload + soft delete
│       ├── analytics/                # Query analytics
│       ├── members/                  # RBAC invite/remove
│       ├── conversations/[id]/export # PDF conversation export
│       └── health/                   # Unauthenticated health check
├── lib/
│   ├── rag/                          # search, rerank, chunker, embedder, prompts
│   ├── inngest/functions/            # process-document, evaluate-response
│   ├── analytics/                    # trackQueryEvent, getAnalytics
│   ├── pdf/                          # @react-pdf/renderer template
│   ├── validation/                   # Zod schemas per domain
│   ├── config.ts                     # All magic numbers centralized
│   └── errors.ts                     # Typed error classes
└── components/
    ├── chat/                         # ChatInterface, MessageBubble, CitationBadge
    ├── documents/                    # DocumentManager, UploadZone, DocumentList
    ├── analytics/                    # AnalyticsDashboard, QueriesChart, KpiCard
    └── settings/                     # SettingsForm, MembersTable
```

---

## License

MIT — see [LICENSE](LICENSE).
