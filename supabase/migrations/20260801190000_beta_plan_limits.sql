-- Beta-launch quotas: slightly tighter than the initial seed while real usage
-- patterns are unknown. Mirrored in src/lib/usage.ts PLANS.
update public.plan_limits set tokens_5h = 20000, tokens_week = 80000 where plan = 'free';
update public.plan_limits set tokens_5h = 150000, tokens_week = 750000 where plan = 'pro';
