-- Migration 005: Query events audit log + analytics

create table query_events (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  user_id             uuid not null references auth.users(id),
  conversation_id     uuid references conversations(id) on delete set null,
  message_id          uuid references messages(id) on delete set null,
  -- What was searched / returned
  retrieved_chunk_ids uuid[] not null default '{}',
  reranked_chunk_ids  uuid[] not null default '{}',
  -- Performance + cost
  latency_ms          int,
  input_tokens        int,
  output_tokens       int,
  total_cost_usd      numeric(10, 6),  -- e.g. 0.000120
  -- Metadata
  created_at          timestamptz not null default now()
);

create index query_events_workspace_idx
  on query_events(workspace_id, created_at desc);
create index query_events_user_idx
  on query_events(user_id, created_at desc);
