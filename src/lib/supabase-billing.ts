/**
 * Supabase-backed billing: plan, token usage (5h + week), bonus credits.
 * Requires schema from supabase/schema.sql (RPCs + RLS).
 */
import { getSupabase } from "./supabase";
import type { UsagePlanId, UsageStateData } from "./usage";
import { emptyUsage, normalizeUsage } from "./usage";

export type BillingSource = "supabase" | "local" | "none";

export interface BillingSnapshot extends UsageStateData {
  source: BillingSource;
  email?: string | null;
}

function mapBillingJson(raw: Record<string, unknown>): UsageStateData {
  const plan: UsagePlanId = raw.plan === "pro" ? "pro" : "free";
  const h5 = (raw.h5 ?? {}) as Record<string, unknown>;
  const week = (raw.week ?? {}) as Record<string, unknown>;

  return normalizeUsage({
    plan,
    credits: typeof raw.credits === "number" ? raw.credits : 0,
    h5: {
      key: String(h5.key ?? ""),
      endsAt: Number(h5.endsAt) || Date.now() + 5 * 3600_000,
      used: Number(h5.used) || 0,
    },
    week: {
      key: String(week.key ?? ""),
      endsAt: Number(week.endsAt) || Date.now() + 7 * 24 * 3600_000,
      used: Number(week.used) || 0,
    },
  });
}

export async function isBillingUser(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  return Boolean(data.session?.user);
}

export async function fetchBilling(): Promise<BillingSnapshot | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await sb.rpc("get_billing");
  if (error) {
    console.warn("[beide billing] get_billing:", error.message);
    return null;
  }
  const mapped = mapBillingJson((data ?? {}) as Record<string, unknown>);
  return {
    ...mapped,
    source: "supabase",
    email: user.email,
  };
}

export async function spendTokensCloud(
  amount: number,
): Promise<{ ok: boolean; data?: UsageStateData; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session?.user) {
    return { ok: false, error: "Not signed in" };
  }

  const { data, error } = await sb.rpc("spend_tokens", {
    p_amount: Math.max(1, Math.floor(amount)),
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  const raw = (data ?? {}) as Record<string, unknown>;
  if (raw.ok === false) {
    return {
      ok: false,
      error: String(raw.message ?? "limit_exceeded"),
      data: mapBillingJson(raw),
    };
  }
  return { ok: true, data: mapBillingJson(raw) };
}

export async function setPlanCloud(plan: UsagePlanId): Promise<UsageStateData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("set_my_plan", { p_plan: plan });
  if (error) {
    console.warn("[beide billing] set_my_plan:", error.message);
    return null;
  }
  return mapBillingJson((data ?? {}) as Record<string, unknown>);
}

export async function addCreditsCloud(
  amount = 10_000,
): Promise<UsageStateData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("add_credits", {
    p_amount: Math.max(0, Math.floor(amount)),
  });
  if (error) {
    console.warn("[beide billing] add_credits:", error.message);
    return null;
  }
  return mapBillingJson((data ?? {}) as Record<string, unknown>);
}

export async function resetUsageCloud(): Promise<UsageStateData | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("reset_usage_windows");
  if (error) {
    console.warn("[beide billing] reset_usage_windows:", error.message);
    return null;
  }
  return mapBillingJson((data ?? {}) as Record<string, unknown>);
}

export function guestUsage(): BillingSnapshot {
  return { ...emptyUsage("free"), source: "local" };
}
