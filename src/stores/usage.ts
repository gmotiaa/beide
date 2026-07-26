import { create } from "zustand";
import i18n from "../i18n";
import { getBeide } from "../lib/ipc";
import {
  TOOL_TOKEN_COST,
  applySpend,
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
  load: () => Promise<void>;
  loadHistory: (days?: number) => Promise<void>;
  setPlan: (plan: UsagePlanId) => Promise<void>;
  addCredits: (amount?: number) => Promise<void>;
  recordPrompt: (text: string) => Promise<{ ok: boolean; reason?: string }>;
  recordTools: (count?: number) => Promise<void>;
  resetToday: () => Promise<void>;
  clearError: () => void;
}

const fallback = emptyUsage("free");

function persistLocal(data: UsageStateData) {
  try {
    localStorage.setItem("beide.usage", JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function readLocal(): UsageStateData {
  try {
    const raw = localStorage.getItem("beide.usage");
    return normalizeUsage(raw ? JSON.parse(raw) : null);
  } catch {
    return fallback;
  }
}

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

  load: async () => {
    set({ busy: true });
    try {
      // Prefer Supabase when signed in
      try {
        if (await isBillingUser()) {
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
        }
      } catch (e) {
        console.warn("[beide usage] cloud load failed", e);
      }

      // Guest / offline → local Electron file or localStorage
      const api = getBeide();
      if (api?.usage) {
        try {
          const data = await api.usage.get();
          set({
            data: normalizeUsage(data),
            source: "local",
            accountEmail: null,
            loaded: true,
          });
          return;
        } catch {
          /* fall through */
        }
      }

      set({
        data: readLocal(),
        source: "local",
        accountEmail: null,
        loaded: true,
      });
    } finally {
      set({ busy: false });
    }
  },

  setPlan: async (plan) => {
    if (get().source === "supabase") {
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
      return;
    }

    // Local fallback — no IPC setPlan (removed for security); persist locally only
    const next = normalizeUsage({ ...get().data, plan });
    set({ data: next, source: "local", error: null });
    persistLocal(next);
  },

  addCredits: async (amount = 10_000) => {
    if (get().source === "supabase") {
      set({ busy: true });
      try {
        const res = await addCreditsCloud(amount);
        if (res.ok && res.data) set({ data: res.data, error: null });
        else set({ error: res.message ?? i18n.t("settings.creditsFailed") });
      } finally {
        set({ busy: false });
      }
      return;
    }
    // Local demo top-up
    const cur = normalizeUsage(get().data);
    const next = { ...cur, credits: cur.credits + Math.max(0, amount) };
    set({ data: next, error: null });
    if (get().source === "local") persistLocal(next);
  },

  recordPrompt: async (text) => {
    const cost = estimateTokens(text || "(image)");
    const data = normalizeUsage(get().data);
    const gate = canSpend(data, cost);
    if (!gate.ok) return { ok: false, reason: denialMessage(gate.code) };

    // Cloud: atomic spend_tokens RPC
    if (get().source === "supabase") {
      const res = await spendTokensCloud(cost);
      // `res.data` on a rejection is a re-fetched snapshot, not the rejection
      // envelope — safe to trust in both branches.
      if (res.data) set({ data: res.data });
      if (!res.ok) {
        const reason = res.message ?? denialMessage(undefined);
        set({ error: reason });
        return { ok: false, reason };
      }
      set({ error: null });
      return { ok: true };
    }

    // Local Electron / localStorage
    const api = getBeide();
    if (api?.usage) {
      const next = await api.usage.increment({ tokens: cost });
      set({ data: normalizeUsage(next), source: "local" });
      return { ok: true };
    }

    const next = applySpend(data, cost).data;
    set({ data: next, source: "local" });
    persistLocal(next);
    return { ok: true };
  },

  recordTools: async (count = 1) => {
    const n = Math.max(1, count);
    const cost = TOOL_TOKEN_COST * n;

    if (get().source === "supabase") {
      const res = await spendTokensCloud(cost);
      if (res.data) set({ data: res.data });
      if (!res.ok) set({ error: res.message ?? denialMessage(undefined) });
      return;
    }

    const api = getBeide();
    if (api?.usage) {
      const next = await api.usage.increment({ tools: n });
      set({ data: normalizeUsage(next), source: "local" });
      return;
    }

    const next = applySpend(normalizeUsage(get().data), cost).data;
    set({ data: next, source: "local" });
    persistLocal(next);
  },

  resetToday: async () => {
    if (get().source === "supabase") {
      set({ busy: true });
      try {
        const res = await resetUsageCloud();
        if (res.ok && res.data) set({ data: res.data, error: null });
        else set({ error: res.message ?? i18n.t("settings.resetFailed") });
      } finally {
        set({ busy: false });
      }
      return;
    }
    // Local fallback — no IPC resetToday (removed for security); reset locally only
    const next = emptyUsage(get().data.plan);
    set({ data: next, source: "local", error: null });
    persistLocal(next);
  },
}));
