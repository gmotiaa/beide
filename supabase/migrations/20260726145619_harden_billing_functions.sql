-- All functions get an empty search_path + fully qualified names, atomic ledger
-- locking, an audit trail and a demo-mode gate on the self-service RPCs.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.usage_window_5h(ts timestamptz default now())
returns table (wkey text, ends_at timestamptz)
language sql
immutable
set search_path = ''
as $$
  select
    'h5_' || floor(extract(epoch from ts) / (5 * 3600))::text,
    to_timestamp((floor(extract(epoch from ts) / (5 * 3600)) + 1) * (5 * 3600));
$$;

create or replace function public.usage_window_week(ts timestamptz default now())
returns table (wkey text, ends_at timestamptz)
language sql
immutable
set search_path = ''
as $$
  select
    'wk_' || floor(extract(epoch from ts) / (7 * 24 * 3600))::text,
    to_timestamp((floor(extract(epoch from ts) / (7 * 24 * 3600)) + 1) * (7 * 24 * 3600));
$$;

-- Upsert-with-RETURNING always yields a row *and* takes the row lock, so a
-- single call is enough — the old triple select-for-update dance could still
-- return NULL when a concurrent transaction inserted the row first.
create or replace function public.ensure_usage_ledger(p_user uuid)
returns public.usage_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  led public.usage_ledger;
  h5 record;
  wk record;
begin
  insert into public.usage_ledger (user_id)
  values (p_user)
  on conflict (user_id) do update set user_id = excluded.user_id
  returning * into led;

  select * into h5 from public.usage_window_5h(now());
  select * into wk from public.usage_window_week(now());

  if led.h5_key is distinct from h5.wkey or led.week_key is distinct from wk.wkey then
    update public.usage_ledger u
    set
      h5_key = h5.wkey,
      h5_ends_at = h5.ends_at,
      h5_used = case when u.h5_key = h5.wkey then u.h5_used else 0 end,
      week_key = wk.wkey,
      week_ends_at = wk.ends_at,
      week_used = case when u.week_key = wk.wkey then u.week_used else 0 end,
      updated_at = now()
    where u.user_id = p_user
    returning * into led;
  end if;

  return led;
end;
$$;

create or replace function public.get_billing()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  prof public.profiles;
  led public.usage_ledger;
  lim public.plan_limits;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into prof from public.profiles p where p.id = uid;
  if not found then
    insert into public.profiles (id, email, plan, credits)
    values (uid, (select auth.jwt() ->> 'email'), 'free', 0)
    on conflict (id) do update set updated_at = now()
    returning * into prof;
  end if;

  led := public.ensure_usage_ledger(uid);
  select * into lim from public.plan_limits l where l.plan = prof.plan;

  return jsonb_build_object(
    'ok', true,
    'plan', prof.plan,
    'credits', prof.credits,
    'email', prof.email,
    'demo', coalesce((public.app_flag('demo_billing', 'false'::jsonb))::boolean, false),
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

create or replace function public.spend_tokens(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
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
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if cost > 5000000 then
    raise exception 'amount too large' using errcode = '22003';
  end if;

  -- Locks the profile row first, then the ledger row: always the same order,
  -- so two concurrent spends can never deadlock against each other.
  select * into prof from public.profiles p where p.id = uid for update;
  if not found then
    raise exception 'profile missing' using errcode = 'P0002';
  end if;

  led := public.ensure_usage_ledger(uid);
  select * into lim from public.plan_limits l where l.plan = prof.plan;

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

  if from_plan > 0 then
    update public.usage_ledger
    set
      h5_used = h5_used + from_plan,
      week_used = week_used + from_plan,
      updated_at = now()
    where user_id = uid;
  end if;

  if from_credits > 0 then
    perform set_config('beide.billing_ctx', 'on', true);
    update public.profiles
    set credits = credits - from_credits, updated_at = now()
    where id = uid;
    perform set_config('beide.billing_ctx', 'off', true);
  end if;

  insert into public.usage_events (user_id, kind, tokens, from_plan, from_credits)
  values (uid, 'spend', cost, from_plan, from_credits);

  return public.get_billing() || jsonb_build_object('ok', true, 'spent', cost);
end;
$$;

create or replace function public.set_my_plan(p_plan text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  old_plan text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not coalesce((public.app_flag('demo_billing', 'false'::jsonb))::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'demo_disabled',
      'message', 'Self-service plan changes are disabled on this project'
    );
  end if;
  if p_plan not in ('free', 'pro') then
    raise exception 'invalid plan' using errcode = '22023';
  end if;

  select p.plan into old_plan from public.profiles p where p.id = uid for update;
  if not found then
    raise exception 'profile missing' using errcode = 'P0002';
  end if;

  perform set_config('beide.billing_ctx', 'on', true);
  update public.profiles
  set plan = p_plan, updated_at = now()
  where id = uid;
  perform set_config('beide.billing_ctx', 'off', true);

  if old_plan is distinct from p_plan then
    insert into public.usage_events (user_id, kind, meta)
    values (uid, 'plan_change', jsonb_build_object('from', old_plan, 'to', p_plan));
  end if;

  perform public.ensure_usage_ledger(uid);
  return public.get_billing();
end;
$$;

create or replace function public.add_credits(p_amount bigint default 10000)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cap bigint := coalesce((public.app_flag('credit_grant_daily_cap', '100000'::jsonb))::bigint, 100000);
  amt bigint := greatest(0, least(coalesce(p_amount, 0), cap));
  granted_24h bigint;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not coalesce((public.app_flag('demo_billing', 'false'::jsonb))::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'demo_disabled',
      'message', 'Self-service credit top-up is disabled on this project'
    );
  end if;

  perform 1 from public.profiles p where p.id = uid for update;
  if not found then
    raise exception 'profile missing' using errcode = 'P0002';
  end if;

  -- Rolling 24h cap: without it the RPC is an unlimited free-credit faucet.
  select coalesce(sum(e.tokens), 0) into granted_24h
  from public.usage_events e
  where e.user_id = uid
    and e.kind = 'credit_grant'
    and e.created_at > now() - interval '24 hours';

  if granted_24h + amt > cap then
    return jsonb_build_object(
      'ok', false,
      'error', 'daily_cap_reached',
      'message', 'Daily credit cap reached',
      'grantedLast24h', granted_24h,
      'cap', cap
    );
  end if;

  perform set_config('beide.billing_ctx', 'on', true);
  update public.profiles
  set credits = credits + amt, updated_at = now()
  where id = uid;
  perform set_config('beide.billing_ctx', 'off', true);

  insert into public.usage_events (user_id, kind, tokens)
  values (uid, 'credit_grant', amt);

  return public.get_billing() || jsonb_build_object('added', amt);
end;
$$;

create or replace function public.reset_usage_windows()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  h5 record;
  wk record;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not coalesce((public.app_flag('demo_billing', 'false'::jsonb))::boolean, false) then
    return jsonb_build_object(
      'ok', false,
      'error', 'demo_disabled',
      'message', 'Usage reset is disabled on this project'
    );
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

  insert into public.usage_events (user_id, kind) values (uid, 'reset');

  return public.get_billing();
end;
$$;

-- Daily usage roll-up for the account screen.
create or replace function public.get_usage_history(p_days int default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  days int := least(greatest(coalesce(p_days, 14), 1), 90);
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(t) order by t.day)
      from (
        select
          (date_trunc('day', e.created_at))::date::text as day,
          sum(e.tokens) filter (where e.kind = 'spend')::bigint as tokens,
          sum(e.from_credits) filter (where e.kind = 'spend')::bigint as credits_used,
          count(*) filter (where e.kind = 'spend')::bigint as calls
        from public.usage_events e
        where e.user_id = uid
          and e.created_at > now() - (days || ' days')::interval
        group by 1
      ) t
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
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

-- Keep profiles.email in sync when the user changes it in auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();
