-- Generous quotas. Two purposes at once:
-- 1) reconcile the hosted drift: the live free row was hand-edited to
--    50k/300k while migrations said 20k/80k — this codifies the live values
--    instead of silently downgrading users on the next `db push`;
-- 2) raise Pro so the paid tier is meaningfully roomy (≈8× free per window).
-- Mirrored in src/lib/usage.ts PLANS — update both together, always.
-- NOTE: file created without the supabase CLI (not installed on this host);
-- timestamp follows the CLI naming convention. Run `supabase db push` +
-- `supabase migration list` from a machine with the linked CLI to apply.
update public.plan_limits set tokens_5h = 50000, tokens_week = 300000 where plan = 'free';
update public.plan_limits set tokens_5h = 400000, tokens_week = 2000000 where plan = 'pro';
