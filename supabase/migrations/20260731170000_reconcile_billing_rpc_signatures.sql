-- Reconcile the hosted floating-point billing schema with fresh local resets.
--
-- A hosted-only migration changed token/credit columns and RPC parameters from
-- bigint to double precision. The migration was never committed, so production
-- and `supabase db reset` ended with different PostgREST signatures. Preserve
-- existing fractional audit data, expose exactly one overload per RPC, and
-- assert the intended role grants in the same transaction.

alter table public.plan_limits
  alter column tokens_5h type double precision using tokens_5h::double precision,
  alter column tokens_week type double precision using tokens_week::double precision;

alter table public.profiles
  alter column credits type double precision using credits::double precision;

alter table public.usage_ledger
  alter column h5_used type double precision using h5_used::double precision,
  alter column week_used type double precision using week_used::double precision;

alter table public.usage_events
  alter column tokens type double precision using tokens::double precision,
  alter column from_plan type double precision using from_plan::double precision,
  alter column from_credits type double precision using from_credits::double precision;

-- The hosted compatibility migration replaced this function with an immutable
-- default-only stub. Restore the server-side feature flag lookup.
create or replace function public.app_flag(
  p_key text,
  p_default jsonb default 'null'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.value from public.app_config c where c.key = p_key),
    p_default
  );
$$;

revoke all on function public.app_flag(text, jsonb)
  from public, anon, authenticated;

-- Remove the local bigint overload before creating the sole public RPC. Two
-- overloads with the same JSON argument name make PostgREST dispatch ambiguous.
drop function if exists public.spend_tokens(bigint);

create or replace function public.spend_tokens(p_amount double precision)
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
  cost double precision := greatest(1.0, coalesce(p_amount, 0.0));
  plan_room double precision;
  from_plan double precision;
  from_credits double precision;
  remaining double precision;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_amount::text in ('NaN', 'Infinity', '-Infinity') or cost > 5000000.0 then
    raise exception 'invalid amount' using errcode = '22003';
  end if;

  -- Always lock profile before ledger; concurrent spends therefore share one
  -- lock order and cannot both consume the same remaining balance.
  select * into prof from public.profiles p where p.id = uid for update;
  if not found then
    raise exception 'profile missing' using errcode = 'P0002';
  end if;

  led := public.ensure_usage_ledger(uid);
  select * into lim from public.plan_limits l where l.plan = prof.plan;

  plan_room := greatest(
    0.0,
    least(lim.tokens_5h - led.h5_used, lim.tokens_week - led.week_used)
  );

  remaining := cost;
  from_plan := least(plan_room, remaining);
  remaining := remaining - from_plan;
  from_credits := least(prof.credits, remaining);
  remaining := remaining - from_credits;

  if remaining > 0.000001 then
    return jsonb_build_object(
      'ok', false,
      'error', 'limit_exceeded',
      'message', 'Token limit exceeded',
      'h5Left', greatest(0.0, lim.tokens_5h - led.h5_used),
      'weekLeft', greatest(0.0, lim.tokens_week - led.week_used),
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
    set credits = greatest(0.0, credits - from_credits), updated_at = now()
    where id = uid;
    perform set_config('beide.billing_ctx', 'off', true);
  end if;

  insert into public.usage_events (user_id, kind, tokens, from_plan, from_credits)
  values (uid, 'spend', cost, from_plan, from_credits);

  return public.get_billing() || jsonb_build_object('ok', true, 'spent', cost);
end;
$$;

drop function if exists public.add_credits(bigint);

create or replace function public.add_credits(
  p_amount double precision default 10000.0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cap double precision := coalesce(
    (public.app_flag('credit_grant_daily_cap', '100000'::jsonb))::double precision,
    100000.0
  );
  amt double precision := greatest(0.0, least(coalesce(p_amount, 0.0), cap));
  granted_24h double precision;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'invalid amount' using errcode = '22003';
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

  select coalesce(sum(e.tokens), 0.0) into granted_24h
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

revoke all on function public.spend_tokens(double precision)
  from public, anon;
revoke all on function public.add_credits(double precision)
  from public, anon;
grant execute on function public.spend_tokens(double precision) to authenticated;
grant execute on function public.add_credits(double precision) to authenticated;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.spend_tokens(double precision)',
    'EXECUTE'
  ) then
    raise exception 'authenticated must execute spend_tokens(double precision)';
  end if;
  if has_function_privilege(
    'anon',
    'public.spend_tokens(double precision)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute spend_tokens(double precision)';
  end if;
  if to_regprocedure('public.spend_tokens(bigint)') is not null then
    raise exception 'ambiguous spend_tokens(bigint) overload remains';
  end if;
end;
$$;
