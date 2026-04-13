-- Migration 007: Auto-update updated_at columns via trigger function

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger workspaces_updated_at
  before update on workspaces
  for each row execute function set_updated_at();

create trigger documents_updated_at
  before update on documents
  for each row execute function set_updated_at();

create trigger conversations_updated_at
  before update on conversations
  for each row execute function set_updated_at();
