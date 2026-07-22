-- ═══════════════════════════════════════════════════════════
-- beide — Supabase schema
-- Paste into: Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════

-- 1) Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  theme text default 'light' check (theme in ('light', 'dark', 'midnight')),
  language text default 'ru' check (language in ('ru', 'en')),
  permission_mode text default 'ask' check (permission_mode in ('ask', 'auto')),
  -- subscription / billing
  plan text not null default 'free' check (plan in ('free', 'pro')),
  credits bigint not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- migrate columns if table already existed without billing fields
alter table public.profiles
  add column if not exists plan text not null default 'free';
alter table public.profiles
  add column if not exists credits bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'pro'));
  end if;
end $$;

create index if not exists profiles_email_idx on public.profiles (email);

-- 2) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 3) Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, plan, credits)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    'free',
    0
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.usage_ledger (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Usage ledger (token counters for 5h + week windows)
create table if not exists public.usage_ledger (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  h5_key text not null default '',
  h5_ends_at timestamptz not null default now(),
  h5_used bigint not null default 0 check (h5_used >= 0),
  week_key text not null default '',
  week_ends_at timestamptz not null default now(),
  week_used bigint not null default 0 check (week_used >= 0),
  updated_at timestamptz not null default now()
);

drop trigger if exists usage_ledger_set_updated_at on public.usage_ledger;
create trigger usage_ledger_set_updated_at
  before update on public.usage_ledger
  for each row execute function public.set_updated_at();

-- Plan limits (read-only catalog)
create table if not exists public.plan_limits (
  plan text primary key check (plan in ('free', 'pro')),
  tokens_5h bigint not null,
  tokens_week bigint not null,
  label text not null
);

insert into public.plan_limits (plan, tokens_5h, tokens_week, label) values
  ('free', 25000, 100000, 'Free'),
  ('pro', 200000, 1000000, 'Pro')
on conflict (plan) do update set
  tokens_5h = excluded.tokens_5h,
  tokens_week = excluded.tokens_week,
  label = excluded.label;

-- 5) Window helpers (5h + 7d fixed buckets from epoch)
create or replace function public.usage_window_5h(ts timestamptz default now())
returns table (wkey text, ends_at timestamptz)
language sql
immutable
as $$
  select
    'h5_' || floor(extract(epoch from ts) / (5 * 3600))::text,
    to_timestamp((floor(extract(epoch from ts) / (5 * 3600)) + 1) * (5 * 3600));
$$;

create or replace function public.usage_window_week(ts timestamptz default now())
returns table (wkey text, ends_at timestamptz)
language sql
immutable
as $$
  select
    'wk_' || floor(extract(epoch from ts) / (7 * 24 * 3600))::text,
    to_timestamp((floor(extract(epoch from ts) / (7 * 24 * 3600)) + 1) * (7 * 24 * 3600));
$$;

-- Ensure ledger row exists and windows are rolled
create or replace function public.ensure_usage_ledger(p_user uuid)
returns public.usage_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.usage_ledger;
  h5 record;
  wk record;
begin
  insert into public.usage_ledger (user_id)
  values (p_user)
  on conflict (user_id) do nothing;

  select * into h5 from public.usage_window_5h(now());
  select * into wk from public.usage_window_week(now());

  update public.usage_ledger u
  set
    h5_key = case when u.h5_key = h5.wkey then u.h5_key else h5.wkey end,
    h5_ends_at = case when u.h5_key = h5.wkey then u.h5_ends_at else h5.ends_at end,
    h5_used = case when u.h5_key = h5.wkey then u.h5_used else 0 end,
    week_key = case when u.week_key = wk.wkey then u.week_key else wk.wkey end,
    week_ends_at = case when u.week_key = wk.wkey then u.week_ends_at else wk.ends_at end,
    week_used = case when u.week_key = wk.wkey then u.week_used else 0 end,
    updated_at = now()
  where u.user_id = p_user
  returning * into row;

  return row;
end;
$$;

-- 6) Public RPCs ───────────────────────────────────────────

-- Get billing snapshot for current user
create or replace function public.get_billing()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  led public.usage_ledger;
  lim public.plan_limits;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into prof from public.profiles where id = uid;
  if not found then
    insert into public.profiles (id, email, plan, credits)
    values (uid, auth.jwt()->>'email', 'free', 0)
    returning * into prof;
  end if;

  led := public.ensure_usage_ledger(uid);
  select * into lim from public.plan_limits where plan = prof.plan;

  return jsonb_build_object(
    'plan', prof.plan,
    'credits', prof.credits,
    'limits', jsonb_build_object(
      'tokens5h', lim.tokens_5h,
      'tokensWeek', lim.tokens_week,
      'label', lim.label
    ),
    'h5', jsonb_build_object(
      'key', led.h5_key,
      'endsAt', (extract(epoch from led.h5_ends_at) * 1000)::bigint,
      'used', led.h5_used
    ),
    'week', jsonb_build_object(
      'key', led.week_key,
      'endsAt', (extract(epoch from led.week_ends_at) * 1000)::bigint,
      'used', led.week_used
    )
  );
end;
$$;

-- Spend estimated tokens (atomic)
create or replace function public.spend_tokens(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof public.profiles;
  led public.usage_ledger;
  lim public.plan_limits;
  cost bigint := greatest(1, coalesce(p_amount, 0));
  plan_room bigint;
  from_plan bigint;
  from_credits bigint;
  remaining bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if cost > 5000000 then
    raise exception 'amount too large';
  end if;

  select * into prof from public.profiles where id = uid for update;
  if not found then
    raise exception 'profile missing';
  end if;

  led := public.ensure_usage_ledger(uid);
  -- lock ledger
  select * into led from public.usage_ledger where user_id = uid for update;
  -- re-roll if needed under lock
  led := public.ensure_usage_ledger(uid);
  select * into led from public.usage_ledger where user_id = uid for update;

  select * into lim from public.plan_limits where plan = prof.plan;

  plan_room := greatest(
    0,
    least(lim.tokens_5h - led.h5_used, lim.tokens_week - led.week_used)
  );

  remaining := cost;
  from_plan := least(plan_room, remaining);
  remaining := remaining - from_plan;
  from_credits := least(prof.credits, remaining);
  remaining := remaining - from_credits;

  if remaining > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'limit_exceeded',
      'message', 'Token limit exceeded',
      'h5Left', greatest(0, lim.tokens_5h - led.h5_used),
      'weekLeft', greatest(0, lim.tokens_week - led.week_used),
      'credits', prof.credits
    );
  end if;

  update public.usage_ledger
  set
    h5_used = h5_used + from_plan,
    week_used = week_used + from_plan,
    updated_at = now()
  where user_id = uid;

  if from_credits > 0 then
    update public.profiles
    set credits = credits - from_credits, updated_at = now()
    where id = uid;
  end if;

  return public.get_billing() || jsonb_build_object('ok', true, 'spent', cost);
end;
$$;

-- Set plan (free/pro) — client can switch for demo; production would use Stripe webhook
create or replace function public.set_my_plan(p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_plan not in ('free', 'pro') then
    raise exception 'invalid plan';
  end if;

  update public.profiles
  set plan = p_plan, updated_at = now()
  where id = uid;

  perform public.ensure_usage_ledger(uid);
  return public.get_billing();
end;
$$;

-- Add bonus credits (demo top-up pack)
create or replace function public.add_credits(p_amount bigint default 10000)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  amt bigint := greatest(0, least(coalesce(p_amount, 0), 100000));
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles
  set credits = credits + amt, updated_at = now()
  where id = uid;

  return public.get_billing() || jsonb_build_object('added', amt);
end;
$$;

-- Reset current windows (dev)
create or replace function public.reset_usage_windows()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h5 record;
  wk record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into h5 from public.usage_window_5h(now());
  select * into wk from public.usage_window_week(now());

  insert into public.usage_ledger (user_id, h5_key, h5_ends_at, h5_used, week_key, week_ends_at, week_used)
  values (uid, h5.wkey, h5.ends_at, 0, wk.wkey, wk.ends_at, 0)
  on conflict (user_id) do update set
    h5_key = excluded.h5_key,
    h5_ends_at = excluded.h5_ends_at,
    h5_used = 0,
    week_key = excluded.week_key,
    week_ends_at = excluded.week_ends_at,
    week_used = 0,
    updated_at = now();

  return public.get_billing();
end;
$$;

-- 7) RLS
alter table public.profiles enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.plan_limits enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "usage_ledger_select_own" on public.usage_ledger;
create policy "usage_ledger_select_own"
  on public.usage_ledger for select
  to authenticated
  using (auth.uid() = user_id);

-- no direct insert/update from client — only via RPCs (security definer)

drop policy if exists "plan_limits_read" on public.plan_limits;
create policy "plan_limits_read"
  on public.plan_limits for select
  to authenticated, anon
  using (true);

-- 8) Optional user_settings
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  onboarding_done boolean not null default false,
  last_workspace_path text,
  extras jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_all_own" on public.user_settings;
create policy "user_settings_all_own"
  on public.user_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 9) Backfill
insert into public.profiles (id, email, display_name, plan, credits)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'display_name',
    split_part(coalesce(u.email, 'user'), '@', 1)
  ),
  'free',
  0
from auth.users u
on conflict (id) do nothing;

insert into public.usage_ledger (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- 10) Grants
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.usage_ledger to authenticated;
grant select on public.plan_limits to anon, authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;

grant execute on function public.get_billing() to authenticated;
grant execute on function public.spend_tokens(bigint) to authenticated;
grant execute on function public.set_my_plan(text) to authenticated;
grant execute on function public.add_credits(bigint) to authenticated;
grant execute on function public.reset_usage_windows() to authenticated;

select
  'ok' as status,
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.usage_ledger) as usage_rows,
  (select count(*) from auth.users) as users_count;
