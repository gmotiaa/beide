-- A hosted-only migration temporarily exposed encrypted provider config.
-- Fresh databases do not contain that helper (or the hosted billing overloads),
-- so every optional revoke must be conditional. A plain REVOKE on a missing
-- signature makes `supabase db reset` fail before later reconciliation runs.

revoke all on table public.app_config from public, anon, authenticated;

do $$
begin
  if to_regprocedure('public.get_encrypted_model_api_key()') is not null then
    execute 'revoke all on function public.get_encrypted_model_api_key() from public, anon, authenticated';
  end if;

  if to_regprocedure('public.spend_tokens(double precision)') is not null then
    execute 'revoke all on function public.spend_tokens(double precision) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.add_credits(double precision)') is not null then
    execute 'revoke all on function public.add_credits(double precision) from public, anon, authenticated';
  end if;
end;
$$;
