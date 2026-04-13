-- Migration 008: Row Level Security policies (multi-tenant isolation)
-- Every table that holds user data is protected. Service role bypasses RLS.

-- ─── Helper: check workspace membership ──────────────────────────────────────
create or replace function is_workspace_member(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_editor_or_owner(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function is_workspace_owner(p_workspace_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ─── organizations ────────────────────────────────────────────────────────────
alter table organizations enable row level security;

create policy "organizations_member_select" on organizations for select
  using (
    exists (
      select 1 from workspace_members wm
      join workspaces w on w.id = wm.workspace_id
      where w.org_id = organizations.id
        and wm.user_id = auth.uid()
    )
  );

-- ─── workspaces ───────────────────────────────────────────────────────────────
alter table workspaces enable row level security;

create policy "workspaces_member_select" on workspaces for select
  using (is_workspace_member(id));

create policy "workspaces_owner_update" on workspaces for update
  using (is_workspace_owner(id));

-- ─── workspace_members ────────────────────────────────────────────────────────
alter table workspace_members enable row level security;

-- Any member can see who else is in their workspace
create policy "workspace_members_select" on workspace_members for select
  using (is_workspace_member(workspace_id));

-- Only owners can add/remove/change members
create policy "workspace_members_owner_all" on workspace_members for all
  using (is_workspace_owner(workspace_id));

-- ─── documents ────────────────────────────────────────────────────────────────
alter table documents enable row level security;

create policy "documents_member_select" on documents for select
  using (is_workspace_member(workspace_id) and deleted_at is null);

create policy "documents_editor_insert" on documents for insert
  with check (is_workspace_editor_or_owner(workspace_id));

create policy "documents_editor_update" on documents for update
  using (is_workspace_editor_or_owner(workspace_id));

-- Soft-delete: set deleted_at — actual hard delete by service role cron only
create policy "documents_editor_delete" on documents for delete
  using (is_workspace_editor_or_owner(workspace_id));

-- ─── chunks ───────────────────────────────────────────────────────────────────
alter table chunks enable row level security;

create policy "chunks_member_select" on chunks for select
  using (is_workspace_member(workspace_id));

-- Chunks are only written by Inngest (service role) — no user-facing insert needed
-- Service role bypasses RLS, so no insert policy required here.

-- ─── conversations ────────────────────────────────────────────────────────────
alter table conversations enable row level security;

-- Users can only see their own conversations within workspaces they belong to
create policy "conversations_owner_select" on conversations for select
  using (user_id = auth.uid() and is_workspace_member(workspace_id));

create policy "conversations_owner_insert" on conversations for insert
  with check (user_id = auth.uid() and is_workspace_member(workspace_id));

create policy "conversations_owner_update" on conversations for update
  using (user_id = auth.uid());

create policy "conversations_owner_delete" on conversations for delete
  using (user_id = auth.uid());

-- ─── messages ─────────────────────────────────────────────────────────────────
alter table messages enable row level security;

create policy "messages_owner_select" on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "messages_owner_insert" on messages for insert
  with check (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- ─── query_events ─────────────────────────────────────────────────────────────
alter table query_events enable row level security;

-- Workspace owners/editors can view analytics for their workspace
create policy "query_events_member_select" on query_events for select
  using (is_workspace_member(workspace_id));

-- Insert only by the authenticated user for their own events
create policy "query_events_user_insert" on query_events for insert
  with check (user_id = auth.uid() and is_workspace_member(workspace_id));
