/**
 * Account usage — dual windows (5h + week), token-based.
 * Counting "prompts" is unfair: one huge message can cost more than ten short ones.
 *
 * This module is pure and shared by both processes (renderer stores and the
 * main-process `UsageService`). It therefore returns *codes*, never localized
 * text — the renderer maps codes to i18n strings.
 */

export type UsagePlanId = "free" | "pro";

const WINDOW_5H_MS = 5 * 60 * 60 * 1000;
const WINDOW_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Soft cost charged per tool call (in estimated tokens) */
export const TOOL_TOKEN_COST = 400;

export interface PlanLimits {
  id: UsagePlanId;
  label: string;
  /** Estimated tokens per 5h window */
  tokens5h: number;
  /** Estimated tokens per week */
  tokensWeek: number;
  /** Bonus tokens (extra pool) */
  credits: number;
}

/**
 * Local mirror of `public.plan_limits`. Kept in sync with
 * `supabase/migrations/20260101000000_baseline_schema.sql` — the DB row is the
 * authority, this only covers signed-out / offline use.
 */
export const PLANS: Record<UsagePlanId, PlanLimits> = {
  free: {
    id: "free",
    label: "Free",
    tokens5h: 25_000,
    tokensWeek: 100_000,
    credits: 0,
  },
  pro: {
    id: "pro",
    label: "Pro",
    tokens5h: 200_000,
    tokensWeek: 1_000_000,
    credits: 0,
  },
};

export interface UsageBucket {
  key: string;
  endsAt: number;
  /** Estimated tokens used in this bucket */
  used: number;
}

/** Quota actually enforced by the backend (`plan_limits` row). */
export interface UsageLimits {
  label: string;
  tokens5h: number;
  tokensWeek: number;
}

export interface UsageStateData {
  plan: UsagePlanId;
  /** 5h token usage */
  h5: UsageBucket;
  /** weekly token usage */
  week: UsageBucket;
  /** remaining bonus tokens */
  credits: number;
  /**
   * Limits reported by Supabase. Absent offline — then `PLANS` is used.
   * Always prefer this: the DB is the authority, `PLANS` is only a mirror.
   */
  limits?: UsageLimits;
  /** Server allows self-service plan switch / top-up / reset (demo projects). */
  demo?: boolean;
}

/** Server limits when known, local mirror otherwise. */
export function effectiveLimits(data: UsageStateData): UsageLimits {
  const local = PLANS[data.plan];
  const l = data.limits;
  if (
    l &&
    Number.isFinite(l.tokens5h) &&
    Number.isFinite(l.tokensWeek) &&
    l.tokens5h > 0 &&
    l.tokensWeek > 0
  ) {
    return l;
  }
  return {
    label: local.label,
    tokens5h: local.tokens5h,
    tokensWeek: local.tokensWeek,
  };
}

function bucketIndex(ms: number, ts = Date.now()): number {
  return Math.floor(ts / ms);
}

function makeBucket(windowMs: number, prefix: string, ts = Date.now()): UsageBucket {
  const i = bucketIndex(windowMs, ts);
  return {
    key: `${prefix}_${i}`,
    endsAt: (i + 1) * windowMs,
    used: 0,
  };
}

export function emptyUsage(plan: UsagePlanId = "free"): UsageStateData {
  return {
    plan,
    h5: makeBucket(WINDOW_5H_MS, "h5"),
    week: makeBucket(WINDOW_WEEK_MS, "wk"),
    credits: PLANS[plan].credits,
  };
}

function rollBucket(
  b: UsageBucket | undefined,
  windowMs: number,
  prefix: string,
  ts = Date.now(),
): UsageBucket {
  const fresh = makeBucket(windowMs, prefix, ts);
  if (!b || b.key !== fresh.key) return fresh;
  const endsAt = Number(b.endsAt);
  const used = Number(b.used);
  return {
    key: b.key,
    endsAt: Number.isFinite(endsAt) && endsAt > 0 ? endsAt : fresh.endsAt,
    used:
      Number.isFinite(used) && used > 0
        ? Math.min(Number.MAX_SAFE_INTEGER, used)
        : 0,
  };
}

/** Migrate legacy shapes (prompt counts, tools bucket) into token counters */
export function normalizeUsage(
  raw?: Partial<UsageStateData> | Record<string, unknown> | null,
): UsageStateData {
  const plan: UsagePlanId =
    raw && (raw as UsageStateData).plan === "pro" ? "pro" : "free";
  const r = (raw ?? {}) as Record<string, unknown>;

  let h5 = rollBucket(r.h5 as UsageBucket | undefined, WINDOW_5H_MS, "h5");
  let week = rollBucket(r.week as UsageBucket | undefined, WINDOW_WEEK_MS, "wk");

  // Legacy: today.prompts / tokens
  const legacy = r.today as
    | { prompts?: number; tokens?: number; tools?: number }
    | undefined;
  if (legacy) {
    const seed =
      (typeof legacy.tokens === "number" ? legacy.tokens : 0) ||
      (typeof legacy.prompts === "number" ? legacy.prompts * 800 : 0);
    if (h5.used === 0 && seed > 0) h5 = { ...h5, used: seed };
  }

  // Legacy tools bucket → fold into h5 tokens once
  const legacyTools = r.tools as UsageBucket | undefined;
  if (legacyTools && typeof legacyTools.used === "number" && legacyTools.used > 0) {
    // only if looks like old tool-count (small integers)
    if (legacyTools.used < 500 && h5.used < 1000) {
      h5 = { ...h5, used: h5.used + legacyTools.used * TOOL_TOKEN_COST };
    }
  }

  const rawCredits = Number(r.credits);
  const credits = Number.isFinite(rawCredits)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, rawCredits))
    : PLANS[plan].credits;

  const rawLimits = r.limits as Partial<UsageLimits> | undefined;
  const limits: UsageLimits | undefined =
    rawLimits &&
    Number(rawLimits.tokens5h) > 0 &&
    Number(rawLimits.tokensWeek) > 0
      ? {
          label: String(rawLimits.label ?? PLANS[plan].label),
          tokens5h: Number(rawLimits.tokens5h),
          tokensWeek: Number(rawLimits.tokensWeek),
        }
      : undefined;

  const out: UsageStateData = { plan, h5, week, credits };
  if (limits) out.limits = limits;
  if (typeof r.demo === "boolean") out.demo = r.demo;
  return out;
}

/** Deep copy that keeps `limits` / `demo` — dropping them silently un-syncs the quota. */
export function cloneUsage(d: UsageStateData): UsageStateData {
  const out: UsageStateData = {
    plan: d.plan,
    h5: { ...d.h5 },
    week: { ...d.week },
    credits: d.credits,
  };
  if (d.limits) out.limits = { ...d.limits };
  if (typeof d.demo === "boolean") out.demo = d.demo;
  return out;
}

export function remainingPct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  const left = Math.max(0, limit - used);
  return Math.min(100, Math.round((left / limit) * 1000) / 10);
}

/**
 * Estimate tokens from text.
 * Uses a conservative mix for RU/EN; longer text → higher cost.
 */
export function estimateTokens(text: string): number {
  if (!text) return 32;
  // ~3.2 chars/token for mixed RU (Cyrillic is denser in bytes but similar)
  const fromChars = Math.ceil(text.length / 3.2);
  // Also count words as lower bound for short bursts
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const fromWords = Math.ceil(words * 1.3);
  return Math.max(48, fromChars, fromWords);
}

export function msUntil(endsAt: number, from = Date.now()): number {
  return Math.max(0, endsAt - from);
}

/** Split a countdown into whole hours + minutes so the UI can localize it. */
export function durationParts(ms: number): { hours: number; minutes: number } {
  const clamped = Math.max(0, ms);
  return {
    hours: Math.floor(clamped / 3_600_000),
    minutes: Math.floor((clamped % 3_600_000) / 60_000),
  };
}

export function formatResetAt(endsAt: number, locale = "ru-RU"): string {
  try {
    return new Date(endsAt).toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    const { hours, minutes } = durationParts(msUntil(endsAt));
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  }
}

/** Which window blocked the spend. Renderer maps this to an i18n string. */
export type UsageDenialCode = "h5_exhausted" | "week_exhausted";

export interface SpendGate {
  ok: boolean;
  code?: UsageDenialCode;
  /** Reset moment of the window that blocked, for the "resets at …" hint. */
  endsAt?: number;
}

export function canSpend(data: UsageStateData, costTokens: number): SpendGate {
  const cost = Math.max(1, Math.floor(costTokens));
  const limits = effectiveLimits(data);
  const h5left = limits.tokens5h - data.h5.used;
  const weekLeft = limits.tokensWeek - data.week.used;
  const pool = Math.min(h5left, weekLeft) + data.credits;
  if (pool >= cost) return { ok: true };
  if (h5left + data.credits < cost) {
    return { ok: false, code: "h5_exhausted", endsAt: data.h5.endsAt };
  }
  return { ok: false, code: "week_exhausted", endsAt: data.week.endsAt };
}

export interface SpendOutcome {
  data: UsageStateData;
  /** Tokens taken from the plan windows */
  fromPlan: number;
  /** Tokens taken from the bonus pool */
  fromCredits: number;
  /** Tokens spent past every pool — recorded on the windows, never dropped */
  overshoot: number;
}

/**
 * The single allocation rule, shared by the renderer store and `UsageService`:
 * plan windows first (shared headroom), then bonus credits, and any remainder
 * still lands on the windows. Both processes used to implement this separately
 * and disagreed about the remainder — one dropped it, which under-counted.
 */
export function applySpend(data: UsageStateData, costTokens: number): SpendOutcome {
  const cost = Number.isFinite(costTokens)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(costTokens)))
    : 0;
  const base = cloneUsage(data);
  if (cost <= 0) return { data: base, fromPlan: 0, fromCredits: 0, overshoot: 0 };

  const limits = effectiveLimits(base);
  const planRoom = Math.max(
    0,
    Math.min(limits.tokens5h - base.h5.used, limits.tokensWeek - base.week.used),
  );

  let remaining = cost;
  const fromPlan = Math.min(planRoom, remaining);
  remaining -= fromPlan;

  const fromCredits = Math.min(base.credits, remaining);
  remaining -= fromCredits;

  const overshoot = remaining;
  const charged = fromPlan + overshoot;

  return {
    data: {
      ...base,
      h5: { ...base.h5, used: base.h5.used + charged },
      week: { ...base.week, used: base.week.used + charged },
      credits: base.credits - fromCredits,
    },
    fromPlan,
    fromCredits,
    overshoot,
  };
}
