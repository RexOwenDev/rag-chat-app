-- Migration 004: Conversations and messages

create table conversations (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null default 'New conversation',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index conversations_workspace_user_idx
  on conversations(workspace_id, user_id);
create index conversations_updated_at_idx
  on conversations(updated_at desc);

-- ─── Messages ─────────────────────────────────────────────────────────────────
create type message_role as enum ('user', 'assistant');

create table messages (
  id                  uuid primary key default uuid_generate_v4(),
  conversation_id     uuid not null references conversations(id) on delete cascade,
  role                message_role not null,
  content             text not null,
  -- Arrays of chunk UUIDs: retrieved = top-20 before rerank, cited = shown to user
  retrieved_chunk_ids uuid[] not null default '{}',
  cited_chunk_ids     uuid[] not null default '{}',
  -- Async eval scores (null until evaluate-response Inngest job completes)
  faithfulness_score  float,
  relevance_score     float,
  -- Token usage + cost tracking
  input_tokens        int,
  output_tokens       int,
  created_at          timestamptz not null default now()
);

create index messages_conversation_id_idx
  on messages(conversation_id);
