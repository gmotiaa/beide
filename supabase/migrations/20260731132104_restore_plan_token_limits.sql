-- Restore the token units from the baseline. Hosted values were accidentally
-- replaced with small decimal display values, making every prompt exceed quota.

update public.plan_limits
set tokens_5h = case plan
  when 'free' then 25000
  when 'pro' then 200000
end,
tokens_week = case plan
  when 'free' then 100000
  when 'pro' then 1000000
end
where plan in ('free', 'pro');
