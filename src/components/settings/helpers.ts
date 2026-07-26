import { effectiveLimits, remainingPct, type UsageStateData } from "../../lib/usage";

/**
 * Pure helpers for the settings screen. They live apart from the `.tsx` files
 * on purpose: a module that exports both components and plain functions loses
 * React Fast Refresh, so every edit would full-reload the view in dev.
 */

/** 12_345 → "12.3k", 1_000_000 → "1M" — quota numbers are read, not audited. */
export function formatTokens(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`;
  }
  if (v >= 1000) {
    const k = v / 1000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
  }
  return String(v);
}

/** Compact quota read-out reused by the settings nav. */
export function usageHeadline(data: UsageStateData): { pct: number; low: boolean } {
  const limits = effectiveLimits(data);
  const pct = Math.min(
    remainingPct(data.h5.used, limits.tokens5h),
    remainingPct(data.week.used, limits.tokensWeek),
  );
  return { pct, low: pct < 25 };
}
