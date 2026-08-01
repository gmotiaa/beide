import { create } from "zustand";
import i18n from "../i18n";
import {
  TOOL_TOKEN_COST,
  canSpend,
  emptyUsage,
  estimateTokens,
  normalizeUsage,
  type UsageDenialCode,
  type UsagePlanId,
  type UsageStateData,
} from "../lib/usage";
import {
  addCreditsCloud,
  fetchBilling,
  fetchUsageHistory,
  isBillingUser,
  resetUsageCloud,
  setPlanCloud,
  spendTokensCloud,
  type BillingSource,
  type UsageHistoryDay,
} from "../lib/supabase-billing";

/** `src/lib/usage.ts` is process-shared and stays language-free; the store localizes. */
export function denialMessage(code: UsageDenialCode | undefined): string {
  return code === "week_exhausted"
    ? i18n.t("settings.limitWeekExhausted")
    : i18n.t("settings.limitH5Exhausted");
}

interface UsageStore {
  data: UsageStateData;
  source: BillingSource;
  loaded: boolean;
  /** Cloud user email when source=supabase */
  accountEmail: string | null;
  /** Last billing error shown to the user (RPC rejection, demo gate, …) */
  error: string | null;
  history: UsageHistoryDay[];
  historyLoading: boolean;
  /** True while a cloud snapshot / demo mutation is in flight */
  busy: boolean;
  load: (signedInHint?: boolean) => Promise<void>;
  loadHistory: (days?: number) => Promise<void>;
  setPlan: (plan: UsagePlanId) => Promise<void>;
  addCredits: (amount?: number) => Promise<void>;
  recordPrompt: (text: string) => Promise<{ ok: boolean; reason?: string }>;
  recordTools: (count?: number) => Promise<{ ok: boolean; reason?: string }>;
  /** Charge the provider-reported token count for a finished assistant message. */
  spendActual: (tokens: number) => Promise<void>;
  resetToday: () => Promise<void>;
  clearError: () => void;
}

const fallback = emptyUsage("free");

/**
 * Usage is Supabase-only: the account is mandatory and `spend_tokens` /
 * `get_billing` are the single ledger. There is deliberately no local counter
 * fallback — an editable local file is a bypass, not a quota (the old
 * `%APPDATA%/beide/usage.json` path was removed together with optional auth).
 */
export const useUsageStore = create<UsageStore>((set, get) => ({
  data: fallback,
  source: "none",
  loaded: false,
  accountEmail: null,
  error: null,
  history: [],
  historyLoading: false,
  busy: false,

  clearError: () => set({ error: null }),

  loadHistory: async (days = 14) => {
    if (get().source !== "supabase") {
      set({ history: [], historyLoading: false });
      return;
    }
    set({ historyLoading: true });
    try {
      set({ history: await fetchUsageHistory(days) });
    } finally {
      set({ historyLoading: false });
    }
  },

  load: async (signedInHint = false) => {
    set({ busy: true });
    try {
      const signedIn = signedInHint || (await isBillingUser());
      if (!signedIn) {
        // Signed out — the AuthGate is (or is about to be) on screen; there is
        // nothing to meter yet.
        set({ data: fallback, source: "none", accountEmail: null, loaded: false });
        return;
      }
      const cloud = await fetchBilling();
      if (cloud) {
        set({
          data: normalizeUsage(cloud),
          source: "supabase",
          accountEmail: cloud.email ?? null,
          loaded: true,
          error: null,
        });
        return;
      }
      // A signed-in account must never silently fall back to anything
      // editable when the billing RPC is unavailable.
      set({
        source: "supabase",
        loaded: true,
        error: i18n.t("settings.meteringUnavailable"),
      });
    } catch (e) {
      console.warn("[beide usage] cloud load failed", e);
      set({
        source: "supabase",
        loaded: true,
        error: i18n.t("settings.meteringUnavailable"),
      });
    } finally {
      set({ busy: false });
    }
  },

  setPlan: async (plan) => {
    // Server-side gate: on a non-demo project the plan only changes through
    // the billing provider, so keep the local state as-is and report why.
    set({ busy: true });
    try {
      const res = await setPlanCloud(plan);
      if (res.ok && res.data) {
        set({ data: res.data, source: "supabase", error: null });
      } else {
        set({ error: res.message ?? i18n.t("settings.planChangeFailed") });
      }
    } finally {
      set({ busy: false });
    }
  },

  addCredits: async (amount = 10_000) => {
    set({ busy: true });
    try {
      const res = await addCreditsCloud(amount);
      if (res.ok && res.data) set({ data: res.data, error: null });
      else set({ error: res.message ?? i18n.t("settings.creditsFailed") });
    } finally {
      set({ busy: false });
    }
  },

  // Prompts and tools are only GATED here (local pre-check on the estimate);
  // the actual charge happens in spendActual() with the provider-reported
  // usage from `message_end` — chars/3.2 was a guess that ignored the model's
  // response and tool payloads entirely.
  recordPrompt: async (text) => {
    const cost = estimateTokens(text || "(image)");
    const data = normalizeUsage(get().data);
    const gate = canSpend(data, cost);
    if (!gate.ok) {
      // Publish the normalized snapshot even on rejection: it may have rolled
      // an expired window, and the stale pre-rollover numbers kept a "limit
      // reached" banner on screen after the quota was actually back.
      set({ data });
      return { ok: false, reason: denialMessage(gate.code) };
    }
    set({ data, error: null });
    return { ok: true };
  },

  recordTools: async (count = 1) => {
    const n = Math.max(1, count);
    // Headroom probe — tools used to run (and charge) unboundedly once a
    // prompt was admitted; the caller aborts the turn on a rejection.
    const data = normalizeUsage(get().data);
    const gate = canSpend(data, TOOL_TOKEN_COST * n);
    if (!gate.ok) {
      set({ data });
      return { ok: false, reason: denialMessage(gate.code) };
    }
    return { ok: true };
  },

  spendActual: async (tokens) => {
    const amount = Math.round(tokens);
    if (!Number.isFinite(amount) || amount <= 0) return;
    // Atomic spend_tokens RPC — the server ledger is the authority and
    // hard-blocks past the limit. `res.data` on a rejection is a re-fetched
    // snapshot, not the rejection envelope — safe to trust in both branches.
    const res = await spendTokensCloud(Math.min(amount, 5_000_000));
    if (res.data) set({ data: res.data });
    if (!res.ok) set({ error: res.message ?? denialMessage(undefined) });
  },

  resetToday: async () => {
    set({ busy: true });
    try {
      const res = await resetUsageCloud();
      if (res.ok && res.data) set({ data: res.data, error: null });
      else set({ error: res.message ?? i18n.t("settings.resetFailed") });
    } finally {
      set({ busy: false });
    }
  },
}));
