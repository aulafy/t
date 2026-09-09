-- ExtraClaro PostgreSQL schema for Supabase.
-- Apply this migration before enabling a Supabase repository adapter.
create table if not exists projects (
  id text primary key,
  owner_id text not null,
  name text not null,
  client text not null,
  budget_cents bigint not null,
  version integer not null default 0,
  created_at timestamptz not null
);
create index if not exists projects_owner on projects(owner_id);

create table if not exists changes (
  id text primary key,
  project_id text not null references projects(id),
  root_id text not null,
  revision integer not null default 1,
  title text not null,
  description text not null,
  base_cents bigint not null,
  tax_basis_points integer not null,
  tax_cents bigint not null,
  total_cents bigint not null,
  days integer not null,
  status text not null default 'draft',
  lock_version integer not null default 0,
  token_hash text unique,
  expires_at timestamptz,
  context_version integer,
  previous_cents bigint,
  snapshot_hash text,
  decision_key text,
  decision_name text,
  decision_at timestamptz,
  decision_type text,
  decision_comment text,
  last_operation text,
  created_at timestamptz not null,
  unique(root_id, revision)
);
create index if not exists changes_project on changes(project_id);

create table if not exists events (
  id text primary key,
  change_id text not null references changes(id),
  kind text not null,
  actor text not null,
  at timestamptz not null,
  detail text not null,
  operation_id text not null unique
);
create index if not exists events_change on events(change_id);

create table if not exists request_windows (
  id text primary key,
  used integer not null,
  expires_at bigint not null
);
create index if not exists request_windows_expiry on request_windows(expires_at);

-- The server adapter uses the service role and performs authorization itself.
-- Do not expose this schema through an anon client until RLS policies are added.
