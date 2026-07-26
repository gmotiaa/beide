-- The live project had the stock Supabase grants (anon/authenticated could
-- INSERT/UPDATE/DELETE every public table). RLS limited *rows*, but a signed-in
-- user could still PATCH their own profile to plan='pro', credits=1e9.

-- 1) Billing columns are RPC-only, enforced in the table itself.
create or replace function public.guard_profile_billing_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.plan is distinct from old.plan or new.credits is distinct from old.credits)
     and current_user in ('anon', 'authenticated')
     and coalesce(current_setting('beide.billing_ctx', true), 'off') <> 'on'
  then
    raise exception 'plan/credits are read-only; use the billing RPCs'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_billing on public.profiles;
create trigger profiles_guard_billing
  before update on public.profiles
  for each row execute function public.guard_profile_billing_columns();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- 2) RLS policies — auth.uid() wrapped in a scalar sub-select so it is
-- evaluated once per statement instead of once per row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profile rows are created by the on_auth_user_created trigger (and repaired by
-- get_billing); clients never insert.
drop policy if exists "profiles_insert_own" on public.profiles;

drop policy if exists "usage_ledger_select_own" on public.usage_ledger;
create policy "usage_ledger_select_own"
  on public.usage_ledger for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_all_own" on public.user_settings;
create policy "user_settings_all_own"
  on public.user_settings for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "plan_limits_read" on public.plan_limits;
create policy "plan_limits_read"
  on public.plan_limits for select
  to authenticated, anon
  using (true);

-- 3) Table grants: start from zero, hand back the minimum.
revoke all on all tables in schema public from anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select on public.plan_limits to anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, theme, language, permission_mode)
  on public.profiles to authenticated;

grant select on public.usage_ledger to authenticated;
grant select on public.usage_events to authenticated;
grant select, insert, update, delete on public.user_settings to authenticated;
-- app_config: no grant at all.

-- 4) Function grants: revoke the implicit PUBLIC/anon EXECUTE, then re-grant
-- only the RPCs the signed-in client is meant to call.
revoke all on function public.ensure_usage_ledger(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.handle_user_email_change() from public, anon, authenticated;
revoke all on function public.guard_profile_billing_columns() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.usage_window_5h(timestamptz) from public, anon, authenticated;
revoke all on function public.usage_window_week(timestamptz) from public, anon, authenticated;

revoke all on function public.get_billing() from public, anon;
revoke all on function public.spend_tokens(bigint) from public, anon;
revoke all on function public.set_my_plan(text) from public, anon;
revoke all on function public.add_credits(bigint) from public, anon;
revoke all on function public.reset_usage_windows() from public, anon;
revoke all on function public.get_usage_history(int) from public, anon;

grant execute on function public.get_billing() to authenticated;
grant execute on function public.spend_tokens(bigint) to authenticated;
grant execute on function public.set_my_plan(text) to authenticated;
grant execute on function public.add_credits(bigint) to authenticated;
grant execute on function public.reset_usage_windows() to authenticated;
grant execute on function public.get_usage_history(int) to authenticated;

-- 5) New objects in `public` must be exposed deliberately from now on, the way
-- the platform will require anyway (Data API auto-exposure ends 2026-10-30).
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- 6) Nothing queries profiles by email; the index was never used.
drop index if exists public.profiles_email_idx;
