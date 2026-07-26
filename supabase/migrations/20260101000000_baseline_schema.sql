-- Baseline: the schema as it existed before migration history was introduced.
-- Already applied on the hosted project (registered via `migration repair`),
-- so it only really runs on a fresh local `supabase db reset`.

-- 1) Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  theme text default 'light' check (theme in ('light', 'dark', 'midnight')),
  language text default 'ru' check (language in ('ru', 'en')),
  permission_mode text default 'ask' check (permission_mode in ('ask', 'auto')),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  credits bigint not null default 0 check (credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) updated_at trigger (search_path hardened in a later migration)
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

-- 3) Usage ledger (token counters for the 5h + weekly windows)
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

-- 4) Plan catalog
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

-- 5) Per-user app settings
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  onboarding_done boolean not null default false,
  last_workspace_path text,
  extras jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 6) Profile bootstrap on signup
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
      new.raw_user_meta_data ->> 'display_name',
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

-- 7) RLS on (policies and grants are (re)defined in a later migration)
alter table public.profiles enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.plan_limits enable row level security;
alter table public.user_settings enable row level security;

-- 8) Backfill for accounts created before the profiles table existed
insert into public.profiles (id, email, display_name, plan, credits)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data ->> 'display_name',
    split_part(coalesce(u.email, 'user'), '@', 1)
  ),
  'free',
  0
from auth.users u
on conflict (id) do nothing;

insert into public.usage_ledger (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;
