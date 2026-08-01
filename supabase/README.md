# Supabase backend

The cloud account, plan limits, token billing and the encrypted model-provider
key live here. The account is mandatory: the app gates behind sign-in
(`AuthGate`) and there are no local usage counters — `spend_tokens` /
`get_billing` are the only ledger. The public URL + anon key are baked into
`src/lib/supabase.ts`; `VITE_SUPABASE_*` env vars only override them for
another stack.

## Layout

```
supabase/
  config.toml    local stack (supabase start) + auth policy
  migrations/    the only source of truth for the schema
```

There is no `schema.sql` any more — it drifted from the live project (its
`revoke update on public.profiles` was never applied, which left a privilege
escalation hole open). Migrations replaced it.

| Migration | What it adds |
| --- | --- |
| `20260101000000_baseline_schema` | `profiles`, `usage_ledger`, `plan_limits`, `user_settings`, `handle_new_user()` trigger, RLS enabled |
| `20260726145524_billing_config_and_usage_events` | `app_config`, append-only `usage_events`, `app_flag()` |
| `20260726145619_harden_billing_functions` | every function pinned to `search_path = ''`, demo gate, `get_usage_history()`, email-sync trigger |
| `20260726145710_harden_grants_policies_and_billing_guard` | revoke-all + minimal grants, `(select auth.uid())` policies, billing-column guard trigger |
| `20260731131138_seal_model_credentials_and_legacy_billing_rpcs` | seals hosted-only model credentials and obsolete floating-point billing RPCs |
| `20260731132104_restore_plan_token_limits` | restores token-unit limits after hosted decimal display values blocked every prompt |
| `20260731170000_reconcile_billing_rpc_signatures` | converts billing columns/RPCs to double precision, drops ambiguous overloads |
| `20260801120000_model_credentials_delivery` | locked `model_credentials` table + authenticated-only `get_encrypted_model_api_key()` |
| `20260801150000_chat_sessions_cloud_backup` | `chat_sessions` table — owner-only RLS, directly readable/writable by `authenticated` |
| `20260801190000_beta_plan_limits` | beta quotas: free 20k/5h · 80k/wk, pro 150k/5h · 750k/wk (mirrored in `src/lib/usage.ts`) |

The baseline is registered as already-applied on the hosted project, so
`supabase db push` starts from the second file.

## Workflow

Iterate with `execute_sql` (MCP) or `supabase db query` against a branch or the
local stack, then commit the result:

```bash
supabase migration new <descriptive_name>   # never invent the filename
# paste the SQL, then
supabase db push
supabase migration list
```

After any DDL run the advisors (`supabase db advisors`, or MCP `get_advisors`
for both `security` and `performance`), regenerate types, and re-check the anon
surface:

```bash
supabase gen types typescript --linked > src/lib/database.types.ts
npm run supabase:verify
```

`supabase:verify` is read-only. It goes through PostgREST with the anon key that
ships inside the Electron bundle and asserts that everything except
`plan_limits` answers `401 / 42501`. A new table that was granted by accident
shows up there immediately.

## Rules this schema relies on

* **No implicit exposure.** `alter default privileges … revoke all` is in place
  for `postgres` in `public`, and the hosted project no longer auto-exposes new
  entities (the legacy behaviour is removed on 2026-10-30). **A new table or
  function is invisible to the app until you `grant` it explicitly** — and it
  needs RLS + policies before you do.
* **`plan` and `credits` are read-only for clients.** `authenticated` only holds
  `update (display_name, avatar_url, theme, language, permission_mode)` on
  `profiles`, and `guard_profile_billing_columns()` raises `42501` as a second
  line of defence. Billing changes go through the `SECURITY DEFINER` RPCs, which
  set the transaction-local flag `beide.billing_ctx = 'on'`.
* **Every function pins `search_path = ''`,** so all references are
  schema-qualified.
* **RLS predicates use `(select auth.uid())`,** not bare `auth.uid()` — the
  subquery form is evaluated once per statement instead of once per row.

## The `demo_billing` switch

`set_my_plan`, `add_credits` and `reset_usage_windows` let a user hand
themselves a Pro plan, free credits and a counter reset. They are gated:

```sql
select * from public.app_config where key = 'demo_billing';  -- false by default
```

While it is `false` those RPCs return
`{ ok: false, error: "demo_disabled", message: … }` and the store surfaces the
message instead of changing state. To enable them on a demo project, as
`service_role` (SQL editor / MCP — never from the client):

```sql
update public.app_config set value = 'true'::jsonb where key = 'demo_billing';
```

`add_credits` is additionally capped by `credit_grant_daily_cap` (100 000 tokens
per rolling 24 h, counted from `usage_events`).

`app_config` has RLS enabled and **no policy at all** — it is deliberately
unreachable from `anon`/`authenticated`; only the `SECURITY DEFINER` helper
`app_flag()` reads it.

## Client RPC surface

`EXECUTE` is revoked from `public`/`anon` everywhere; `authenticated` may call
only these:

| RPC | Returns |
| --- | --- |
| `get_billing()` | plan, credits, both windows, `limits`, `demo`, `email` |
| `spend_tokens(p_amount)` | new snapshot, or `{ ok: false, error: "limit_exceeded" }` |
| `get_usage_history(p_days)` | `[{ day, tokens, credits_used, calls }]` |
| `set_my_plan(p_plan)` | demo-gated |
| `add_credits(p_amount)` | demo-gated + daily cap |
| `reset_usage_windows()` | demo-gated |
| `get_encrypted_model_api_key(p_provider)` | AES-256-GCM ciphertext of the provider key; publish/rotate with `npm run supabase:secrets` |

Failure envelopes carry no `h5`/`week` buckets — `src/lib/supabase-billing.ts`
must never feed them to `normalizeUsage()`, or the UI resets to zero.

## `chat_sessions` — a table, not an RPC

Unlike the rest of the client surface, `public.chat_sessions` is granted
directly to `authenticated` (`select, insert, update, delete`) instead of
being RPC-gated: `chat_sessions_own` RLS restricts every row to
`(select auth.uid()) = user_id`, so the table itself is the access boundary.
This is the cloud write-through backup for chat transcripts described in
[docs/CHAT-AND-SESSIONS.md](../docs/CHAT-AND-SESSIONS.md). `supabase:verify`
currently asserts everything except `plan_limits` answers `401 / 42501` for
`anon` — `chat_sessions` should still satisfy that (RLS blocks unauthenticated
reads even though the grant exists), but a signed-in check for the
owner-only behavior isn't in the script yet; if you touch `supabase:verify`,
add one rather than assuming the existing anon-only assertions cover it.

## Not configurable from here

**Leaked Password Protection** (HaveIBeenPwned check) is an Auth setting of the
hosted project, not schema: Dashboard → Authentication → Policies → *Leaked
password protection*. The security advisor keeps warning until it is enabled.
