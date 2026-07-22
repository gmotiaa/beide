import { create } from "zustand";
import { getBeide } from "../lib/ipc";
import {
  canSpend,
  emptyUsage,
  estimateTokens,
  normalizeUsage,
  type UsagePlanId,
  type UsageStateData,
} from "../lib/usage";
import {
  addCreditsCloud,
  fetchBilling,
  isBillingUser,
  resetUsageCloud,
  setPlanCloud,
  spendTokensCloud,
  type BillingSource,
} from "../lib/supabase-billing";
import { TOOL_TOKEN_COST } from "../lib/usage";

interface UsageStore {
  data: UsageStateData;
  source: BillingSource;
  loaded: boolean;
  /** Cloud user email when source=supabase */
  accountEmail: string | null;
  load: () => Promise<void>;
  setPlan: (plan: UsagePlanId) => Promise<void>;
  addCredits: (amount?: number) => Promise<void>;
  recordPrompt: (text: string) => Promise<{ ok: boolean; reason?: string }>;
  recordTools: (count?: number) => Promise<void>;
  resetToday: () => Promise<void>;
  canPrompt: (text?: string) => boolean;
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

  load: async () => {
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
  },

  setPlan: async (plan) => {
    if (get().source === "supabase") {
      const data = await setPlanCloud(plan);
      if (data) {
        set({ data: normalizeUsage(data), source: "supabase" });
        return;
      }
    }

    const api = getBeide();
    if (api?.usage) {
      const data = await api.usage.setPlan(plan);
      set({ data: normalizeUsage(data), source: "local" });
      return;
    }
    const next = normalizeUsage({ ...get().data, plan });
    set({ data: next, source: "local" });
    persistLocal(next);
  },

  addCredits: async (amount = 10_000) => {
    if (get().source === "supabase") {
      const data = await addCreditsCloud(amount);
      if (data) set({ data: normalizeUsage(data) });
      return;
    }
    // Local demo top-up
    const cur = normalizeUsage(get().data);
    const next = { ...cur, credits: cur.credits + Math.max(0, amount) };
    set({ data: next });
    if (get().source === "local") persistLocal(next);
  },

  canPrompt: (text = "") =>
    canSpend(normalizeUsage(get().data), estimateTokens(text)).ok,

  recordPrompt: async (text) => {
    const cost = estimateTokens(text || "(image)");
    const data = normalizeUsage(get().data);
    const gate = canSpend(data, cost);
    if (!gate.ok) return { ok: false, reason: gate.reason };

    // Cloud: atomic spend_tokens RPC
    if (get().source === "supabase") {
      const res = await spendTokensCloud(cost);
      if (!res.ok) {
        if (res.data) set({ data: normalizeUsage(res.data) });
        return {
          ok: false,
          reason: res.error ?? "Лимит токенов исчерпан",
        };
      }
      if (res.data) set({ data: normalizeUsage(res.data) });
      return { ok: true };
    }

    // Local Electron / localStorage
    const api = getBeide();
    if (api?.usage) {
      const next = await api.usage.increment({ tokens: cost });
      set({ data: normalizeUsage(next), source: "local" });
      return { ok: true };
    }

    const limits = (
      await import("../lib/usage")
    ).PLANS[data.plan];
    let h5 = data.h5.used;
    let week = data.week.used;
    let credits = data.credits;
    let remaining = cost;
    const planRoom = Math.max(
      0,
      Math.min(limits.tokens5h - h5, limits.tokensWeek - week),
    );
    const fromPlan = Math.min(planRoom, remaining);
    h5 += fromPlan;
    week += fromPlan;
    remaining -= fromPlan;
    if (remaining > 0) {
      const fromCredits = Math.min(credits, remaining);
      credits -= fromCredits;
      remaining -= fromCredits;
    }
    const next: UsageStateData = {
      plan: data.plan,
      h5: { ...data.h5, used: h5 },
      week: { ...data.week, used: week },
      credits,
    };
    set({ data: next, source: "local" });
    persistLocal(next);
    return { ok: true };
  },

  recordTools: async (count = 1) => {
    const n = Math.max(1, count);
    const cost = TOOL_TOKEN_COST * n;

    if (get().source === "supabase") {
      const res = await spendTokensCloud(cost);
      if (res.data) set({ data: normalizeUsage(res.data) });
      return;
    }

    const api = getBeide();
    if (api?.usage) {
      const next = await api.usage.increment({ tools: n });
      set({ data: normalizeUsage(next), source: "local" });
      return;
    }

    const data = normalizeUsage(get().data);
    const next: UsageStateData = {
      ...data,
      h5: { ...data.h5, used: data.h5.used + cost },
      week: { ...data.week, used: data.week.used + cost },
    };
    set({ data: next, source: "local" });
    persistLocal(next);
  },

  resetToday: async () => {
    if (get().source === "supabase") {
      const data = await resetUsageCloud();
      if (data) set({ data: normalizeUsage(data) });
      return;
    }
    const api = getBeide();
    if (api?.usage) {
      const data = await api.usage.resetToday();
      set({ data: normalizeUsage(data), source: "local" });
      return;
    }
    const next = emptyUsage(get().data.plan);
    set({ data: next, source: "local" });
    persistLocal(next);
  },
}));
