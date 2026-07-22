/**
 * Account usage — dual windows (5h + week), token-based.
 * Counting "prompts" is unfair: one huge message can cost more than ten short ones.
 */

export type UsagePlanId = "free" | "pro";

export const WINDOW_5H_MS = 5 * 60 * 60 * 1000;
export const WINDOW_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

/** Compact token quotas */
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

export interface UsageStateData {
  plan: UsagePlanId;
  /** 5h token usage */
  h5: UsageBucket;
  /** weekly token usage */
  week: UsageBucket;
  /** remaining bonus tokens */
  credits: number;
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
  return {
    key: b.key,
    endsAt: typeof b.endsAt === "number" ? b.endsAt : fresh.endsAt,
    used: Math.max(0, Number(b.used) || 0),
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

  const credits =
    typeof r.credits === "number"
      ? Math.max(0, r.credits)
      : PLANS[plan].credits;

  return { plan, h5, week, credits };
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

export function formatResetIn(ms: number): string {
  if (ms <= 0) return "скоро";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
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
    return formatResetIn(msUntil(endsAt));
  }
}

export function canSpend(
  data: UsageStateData,
  costTokens: number,
): { ok: boolean; reason?: string } {
  const cost = Math.max(1, Math.floor(costTokens));
  const limits = PLANS[data.plan];
  const h5left = limits.tokens5h - data.h5.used;
  const weekLeft = limits.tokensWeek - data.week.used;
  const pool = Math.min(h5left, weekLeft) + data.credits;
  if (pool >= cost) return { ok: true };
  if (h5left + data.credits < cost) {
    return {
      ok: false,
      reason: `Лимит токенов на 5 часов исчерпан. Сброс ${formatResetAt(data.h5.endsAt)}.`,
    };
  }
  return {
    ok: false,
    reason: `Недельный лимит токенов исчерпан. Сброс ${formatResetAt(data.week.endsAt)}.`,
  };
}

/** @deprecated use canSpend */
export function canSendPrompt(data: UsageStateData, text = ""): {
  ok: boolean;
  reason?: string;
} {
  return canSpend(data, estimateTokens(text));
}

export const USAGE_WINDOW_MS = WINDOW_5H_MS;
export const pct = (used: number, limit: number) =>
  limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 1000) / 10);
