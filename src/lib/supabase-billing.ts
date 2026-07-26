/**
 * Supabase-backed billing: plan, token usage (5h + week), bonus credits.
 * Requires the migrations in `supabase/migrations/` (RPCs + RLS + grants).
 *
 * Every RPC answers with a JSON envelope. Success carries the full billing
 * snapshot; failure carries `{ ok: false, error, message }` and must never be
 * fed to `normalizeUsage` — the failure shape has no h5/week buckets, so
 * mapping it would silently reset the counters to zero on screen.
 */
import { getSupabase } from "./supabase";
import type { UsagePlanId, UsageStateData } from "./usage";
import { emptyUsage, normalizeUsage } from "./usage";

export type BillingSource = "supabase" | "local" | "none";

export type BillingErrorCode =
  | "not_configured"
  | "not_signed_in"
  | "limit_exceeded"
  | "demo_disabled"
  | "daily_cap_reached"
  | "rpc_error";

export interface BillingSnapshot extends UsageStateData {
  source: BillingSource;
  email?: string | null;
}

export interface BillingResult {
  ok: boolean;
  /** Fresh snapshot; present whenever the server returned one. */
  data?: UsageStateData;
  error?: BillingErrorCode;
  message?: string;
}

export interface UsageHistoryDay {
  day: string;
  tokens: number;
  creditsUsed: number;
  calls: number;
}

function isEnvelope(raw: unknown): raw is Record<string, unknown> {
  return Boolean(raw) && typeof raw === "object" && !Array.isArray(raw);
}

/** A failed envelope has `ok: false`; a snapshot always carries `h5`. */
function isFailure(raw: Record<string, unknown>): boolean {
  return raw.ok === false || !isEnvelope(raw.h5);
}

function failureOf(raw: Record<string, unknown>): BillingResult {
  const code = String(raw.error ?? "rpc_error");
  const known: BillingErrorCode[] = [
    "limit_exceeded",
    "demo_disabled",
    "daily_cap_reached",
  ];
  return {
    ok: false,
    error: (known as string[]).includes(code)
      ? (code as BillingErrorCode)
      : "rpc_error",
    message: typeof raw.message === "string" ? raw.message : code,
  };
}

function mapBillingJson(raw: Record<string, unknown>): UsageStateData {
  const plan: UsagePlanId = raw.plan === "pro" ? "pro" : "free";
  const h5 = (raw.h5 ?? {}) as Record<string, unknown>;
  const week = (raw.week ?? {}) as Record<string, unknown>;
  const limits = (raw.limits ?? {}) as Record<string, unknown>;

  return normalizeUsage({
    plan,
    credits: typeof raw.credits === "number" ? raw.credits : 0,
    demo: raw.demo === true,
    limits: {
      label: String(limits.label ?? ""),
      tokens5h: Number(limits.tokens5h) || 0,
      tokensWeek: Number(limits.tokensWeek) || 0,
    },
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

async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function isBillingUser(): Promise<boolean> {
  return (await currentUserId()) !== null;
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
  const raw = isEnvelope(data) ? data : {};
  if (isFailure(raw)) {
    console.warn("[beide billing] get_billing envelope:", raw.error ?? raw);
    return null;
  }
  return {
    ...mapBillingJson(raw),
    source: "supabase",
    // profiles.email is kept in sync with auth by the on_auth_user_updated
    // trigger, but the live session is still the freshest source.
    email: user.email ?? (typeof raw.email === "string" ? raw.email : null),
  };
}

/**
 * Generic RPC → envelope bridge shared by every mutating call.
 * `sb.rpc()` hands back a query builder, not a Promise — hence `PromiseLike`.
 */
async function callBillingRpc(
  run: (
    sb: NonNullable<ReturnType<typeof getSupabase>>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<BillingResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "not_configured", message: "Supabase not configured" };
  if (!(await currentUserId())) {
    return { ok: false, error: "not_signed_in", message: "Not signed in" };
  }

  const { data, error } = await run(sb);
  if (error) return { ok: false, error: "rpc_error", message: error.message };

  const raw = isEnvelope(data) ? data : {};
  if (isFailure(raw)) return failureOf(raw);
  return { ok: true, data: mapBillingJson(raw) };
}

export async function spendTokensCloud(amount: number): Promise<BillingResult> {
  const res = await callBillingRpc((sb) =>
    sb.rpc("spend_tokens", { p_amount: Math.max(1, Math.floor(amount)) }),
  );

  // The rejection envelope has no buckets, so pull a real snapshot: otherwise
  // the UI would keep the pre-limit numbers and retry forever.
  if (!res.ok && res.error === "limit_exceeded") {
    const fresh = await fetchBilling();
    if (fresh) return { ...res, data: fresh };
  }
  return res;
}

export async function setPlanCloud(plan: UsagePlanId): Promise<BillingResult> {
  return callBillingRpc((sb) => sb.rpc("set_my_plan", { p_plan: plan }));
}

export async function addCreditsCloud(amount = 10_000): Promise<BillingResult> {
  return callBillingRpc((sb) =>
    sb.rpc("add_credits", { p_amount: Math.max(0, Math.floor(amount)) }),
  );
}

export async function resetUsageCloud(): Promise<BillingResult> {
  return callBillingRpc((sb) => sb.rpc("reset_usage_windows"));
}

/** Daily roll-up for the account screen; empty array when signed out. */
export async function fetchUsageHistory(days = 14): Promise<UsageHistoryDay[]> {
  const sb = getSupabase();
  if (!sb || !(await currentUserId())) return [];

  const { data, error } = await sb.rpc("get_usage_history", { p_days: days });
  if (error) {
    console.warn("[beide billing] get_usage_history:", error.message);
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data.flatMap((row) => {
    if (!isEnvelope(row)) return [];
    return [
      {
        day: String(row.day ?? ""),
        tokens: Number(row.tokens) || 0,
        creditsUsed: Number(row.credits_used) || 0,
        calls: Number(row.calls) || 0,
      },
    ];
  });
}
