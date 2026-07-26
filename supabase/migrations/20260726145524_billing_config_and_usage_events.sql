-- Server-side switches + append-only usage audit trail.

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  description text,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is
  'Server-side feature switches. Writable by service_role only; never by anon/authenticated.';

insert into public.app_config (key, value, description) values
  ('demo_billing', 'false'::jsonb,
   'When true, set_my_plan / add_credits / reset_usage_windows are callable by the signed-in user. Keep false in production — those RPCs let a user grant themselves plan upgrades and credits.'),
  ('credit_grant_daily_cap', '100000'::jsonb,
   'Max bonus credits a single user may be granted per rolling 24h via add_credits.')
on conflict (key) do nothing;

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('spend', 'credit_grant', 'plan_change', 'reset')),
  tokens bigint not null default 0,
  from_plan bigint not null default 0,
  from_credits bigint not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.usage_events is
  'Append-only ledger of billing events. Written only by SECURITY DEFINER RPCs.';

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

alter table public.app_config enable row level security;
alter table public.usage_events enable row level security;

-- app_config: no policies at all → unreachable for anon/authenticated even if a
-- grant regresses. Reads happen inside SECURITY DEFINER functions.

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
  on public.usage_events for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Read a config flag from inside definer functions.
create or replace function public.app_flag(p_key text, p_default jsonb default 'null'::jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.value from public.app_config c where c.key = p_key), p_default);
$$;

revoke all on function public.app_flag(text, jsonb) from public, anon, authenticated;
