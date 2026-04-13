-- Migration 002: Core tables — organizations, workspaces, members, documents, chunks

-- ─── Organizations ────────────────────────────────────────────────────────────
create table organizations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Workspaces ───────────────────────────────────────────────────────────────
create table workspaces (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  system_prompt text,               -- Optional: injected into every chat prompt
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index workspaces_org_id_idx on workspaces(org_id);

-- ─── Workspace Members (RBAC) ─────────────────────────────────────────────────
create type workspace_role as enum ('owner', 'editor', 'viewer');

create table workspace_members (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          workspace_role not null default 'viewer',
  created_at    timestamptz not null default now(),
  unique(workspace_id, user_id)
);

create index workspace_members_user_id_idx  on workspace_members(user_id);
create index workspace_members_ws_id_idx    on workspace_members(workspace_id);

-- ─── Documents ────────────────────────────────────────────────────────────────
create type document_source_type as enum ('pdf', 'docx', 'txt', 'md', 'url');
create type document_status as enum ('pending', 'processing', 'ready', 'error');

create table documents (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  uploaded_by     uuid not null references auth.users(id),
  title           text not null,
  source_type     document_source_type not null,
  source_url      text,                 -- For URL-ingested docs
  storage_path    text,                 -- Supabase Storage object path
  status          document_status not null default 'pending',
  error_message   text,                 -- Populated on error
  chunk_count     int not null default 0,
  page_count      int,
  version         int not null default 1,
  deleted_at      timestamptz,          -- Soft delete: null = active
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Active documents only (excludes soft-deleted)
create index documents_workspace_active_idx
  on documents(workspace_id)
  where deleted_at is null;

create index documents_status_idx on documents(status);

-- ─── Chunks ───────────────────────────────────────────────────────────────────
create table chunks (
  id              uuid primary key default uuid_generate_v4(),
  document_id     uuid not null references documents(id) on delete cascade,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  content         text not null,
  heading_context text,                 -- Nearest preceding heading, if any
  page_number     int,
  chunk_index     int not null,         -- 0-based position within document
  token_count     int not null,
  -- Full-text search vector (auto-updated via generated column)
  fts             tsvector generated always as (to_tsvector('english', content)) stored,
  -- Vector embedding — dimensions set by text-embedding-3-small
  embedding       vector(1536),
  created_at      timestamptz not null default now()
);

create index chunks_document_id_idx   on chunks(document_id);
create index chunks_workspace_id_idx  on chunks(workspace_id);
-- GIN index for BM25-style full-text search
create index chunks_fts_idx           on chunks using gin(fts);
