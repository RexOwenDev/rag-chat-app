/**
 * scripts/generate-diagrams.ts
 *
 * Generates SVG architecture diagrams for the README using the Mermaid CLI.
 *
 * Prerequisites:
 *   npx mmdc --version   (uses @mermaid-js/mermaid-cli via npx, no global install needed)
 *
 * Usage:
 *   npx ts-node scripts/generate-diagrams.ts
 *   npm run generate:diagrams
 *
 * Output: docs/architecture.svg, docs/ingestion.svg, docs/schema.svg
 *
 * Security note: uses execFile (not exec/execSync) so args are passed as an
 * array — no shell expansion, no injection risk regardless of diagram content.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const run = promisify(execFile);

const DOCS_DIR = join(process.cwd(), 'docs');
mkdirSync(DOCS_DIR, { recursive: true });

interface Diagram {
  name: string;
  content: string;
}

const diagrams: Diagram[] = [
  // ── 1. Architecture ──────────────────────────────────────────
  {
    name: 'architecture',
    content: `flowchart TD
  subgraph Ingestion["Ingestion Pipeline"]
    A[Upload PDF / DOCX / URL] --> B[Supabase Storage]
    B --> C[Inngest Step Function]
    C --> D[Extract Text<br/>pdf-parse / mammoth / cheerio]
    D --> E[Semantic Chunker<br/>400 token max · 50 overlap]
    E --> F[OpenAI Embeddings<br/>text-embedding-3-small · 1536d]
    F --> G[(pgvector · chunks table)]
    G --> H[status: ready ✓]
  end

  subgraph Query["RAG Query Pipeline"]
    I[User Question] --> J[Embed Query<br/>Redis cache · SHA-256 key]
    J --> K[Hybrid Search RPC<br/>BM25 FTS + Vector Cosine]
    K --> L[Top 20 Candidates<br/>Reciprocal Rank Fusion]
    L --> M[Cohere Rerank 3<br/>Cross-encoder · Top 5]
    M --> N[Build Context<br/>numbered · sanitized]
    N --> O[Claude via AI Gateway<br/>claude-sonnet-4.6 · streaming]
    O --> P[Response + Citation Badges<br/>1 2 3 inline]
  end

  G -.->|hybrid_search\\nPostgres RPC| K

  style Ingestion fill:#0d1424,stroke:#00d4ff,stroke-width:1px,color:#e2e8f0
  style Query fill:#0d1424,stroke:#00d4ff,stroke-width:1px,color:#e2e8f0`,
  },

  // ── 2. Ingestion Sequence ─────────────────────────────────────
  {
    name: 'ingestion',
    content: `sequenceDiagram
  actor User
  participant UI as Next.js UI
  participant API as API Route
  participant Stor as Supabase Storage
  participant DB as Supabase DB
  participant Inn as Inngest
  participant OAI as OpenAI Embeddings

  User->>UI: Drop file / paste URL
  UI->>API: POST /api/workspaces/{id}/documents
  API->>API: Auth check + RBAC + Zod validate
  API->>Stor: Upload (uuid path)
  Stor-->>API: storage_path
  API->>DB: INSERT documents (status: pending)
  API->>Inn: Send document/process event
  API-->>UI: 200 { document }
  UI->>UI: Optimistic list update

  Inn->>DB: UPDATE status: processing
  Note over Inn: Step 1 — extract-text<br/>pdf-parse / mammoth / cheerio

  Inn->>Inn: Step 2 — chunk-text
  Note over Inn: Paragraph-boundary aware<br/>400 token max · 50 overlap

  Inn->>OAI: Batch embed (groups of 100)
  OAI-->>Inn: float32[1536] per chunk

  Inn->>DB: INSERT chunks (embedding, fts, heading_context)
  Inn->>DB: UPDATE documents SET status=ready, chunk_count=N

  DB-->>UI: Realtime postgres_changes event
  UI->>UI: Show status: ready ✓`,
  },

  // ── 3. ER Diagram ─────────────────────────────────────────────
  {
    name: 'schema',
    content: `erDiagram
  organizations {
    uuid id PK
    text name
    timestamptz created_at
  }
  workspaces {
    uuid id PK
    uuid org_id FK
    text name
    text system_prompt
    timestamptz updated_at
  }
  workspace_members {
    uuid id PK
    uuid workspace_id FK
    uuid user_id FK
    text role
  }
  documents {
    uuid id PK
    uuid workspace_id FK
    text title
    text source_type
    text status
    int chunk_count
    int version
    timestamptz deleted_at
  }
  chunks {
    uuid id PK
    uuid document_id FK
    uuid workspace_id FK
    text content
    text heading_context
    int chunk_index
    vector_1536 embedding
    tsvector fts
  }
  conversations {
    uuid id PK
    uuid workspace_id FK
    uuid user_id FK
    text title
    timestamptz updated_at
  }
  messages {
    uuid id PK
    uuid conversation_id FK
    text role
    text content
    uuid_array cited_chunk_ids
    numeric faithfulness_score
    numeric relevance_score
    int input_tokens
    int output_tokens
  }
  query_events {
    uuid id PK
    uuid workspace_id FK
    uuid conversation_id FK
    int latency_ms
    numeric total_cost_usd
    timestamptz created_at
  }

  organizations ||--o{ workspaces : "has"
  workspaces ||--o{ workspace_members : "has"
  workspaces ||--o{ documents : "contains"
  workspaces ||--o{ conversations : "has"
  workspaces ||--o{ query_events : "tracks"
  documents ||--o{ chunks : "split into"
  conversations ||--o{ messages : "has"
  conversations ||--o{ query_events : "logged in"`,
  },
];

async function main(): Promise<void> {
  console.log(`Generating ${diagrams.length} Mermaid diagrams → docs/*.svg\n`);

  for (const diagram of diagrams) {
    const srcPath = join(DOCS_DIR, `${diagram.name}.mmd`);
    const outPath = join(DOCS_DIR, `${diagram.name}.svg`);

    writeFileSync(srcPath, diagram.content, 'utf8');

    try {
      // execFile: args as array — no shell expansion, no injection risk
      await run(
        'npx',
        ['mmdc', '-i', srcPath, '-o', outPath, '-t', 'dark', '-b', 'transparent'],
        { cwd: process.cwd() }
      );
      console.log(`✓ ${outPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ Failed to generate ${diagram.name}.svg`);
      console.error(`  ${message}`);
      console.error(
        '  Tip: Mermaid CLI uses Puppeteer — if it fails, try:\n' +
          '    npx playwright install chromium'
      );
      process.exit(1);
    }
  }

  console.log('\nAll diagrams generated successfully.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
