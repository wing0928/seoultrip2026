create table if not exists public.trip_sync_state (
  workspace_hash text primary key,
  state jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.trip_sync_state enable row level security;

revoke all on table public.trip_sync_state from anon, authenticated;
grant select, insert, update on table public.trip_sync_state to service_role;

comment on table public.trip_sync_state is 'Shared Seoul trip state. Access is restricted to the trip-sync Edge Function.';
