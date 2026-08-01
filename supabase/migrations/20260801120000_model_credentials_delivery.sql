-- Encrypted model-provider key, delivered to signed-in clients only.
--
-- The ciphertext is AES-256-GCM produced by scripts/supabase-secrets.mjs; the
-- app's main process holds the decryption key and never writes the plaintext
-- to disk. This keeps the key out of unauthenticated reach and out of the
-- database in plain text — it is defence in depth against casual extraction,
-- not a hardware vault: a determined user of the packaged app can still
-- recover it, which is inherent to any client that talks to the provider
-- directly.
--
-- 20260731131138 sealed a hosted-only get_encrypted_model_api_key() that
-- leaked config without an auth gate. This replaces it with a locked table
-- plus a definer function that requires a session.

create table if not exists public.model_credentials (
  provider text primary key,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

alter table public.model_credentials enable row level security;
-- No policies on purpose: the table is reachable only through the definer
-- function below (and the service role, which bypasses RLS for the upsert
-- script).
revoke all on table public.model_credentials from public, anon, authenticated;

drop function if exists public.get_encrypted_model_api_key();
drop function if exists public.get_encrypted_model_api_key(text);

create function public.get_encrypted_model_api_key(p_provider text default 'echogate')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ciphertext text;
begin
  if (select auth.uid()) is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select ciphertext into v_ciphertext
    from public.model_credentials
    where provider = p_provider;
  if v_ciphertext is null then
    return jsonb_build_object('ok', false, 'error', 'not_configured');
  end if;
  return jsonb_build_object(
    'ok', true,
    'provider', p_provider,
    'ciphertext', v_ciphertext
  );
end;
$$;

revoke all on function public.get_encrypted_model_api_key(text) from public, anon;
grant execute on function public.get_encrypted_model_api_key(text) to authenticated;
