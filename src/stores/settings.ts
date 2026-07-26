import { create } from "zustand";
import type { BeideSettings, CheckpointInfo, ThemeId } from "../lib/types";
import { getBeide } from "../lib/ipc";
import { setAppLanguage } from "../i18n";

const DEFAULTS: BeideSettings = {
  language: "ru",
  theme: "dark",
  permissionMode: "ask",
  telemetryEnabled: false,
  defaultAgentMode: "agent",
  modelLabel: "minimaxai/minimax-m3",
};

function applyTheme(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  // Agent Elements dark tokens key off `.dark`
  document.documentElement.classList.toggle("dark", theme !== "light");
  document.documentElement.classList.toggle("light", theme === "light");
}

interface SettingsState {
  settings: BeideSettings;
  loaded: boolean;
  checkpoints: CheckpointInfo[];
  load: () => Promise<void>;
  update: (partial: Partial<BeideSettings>) => Promise<void>;
  refreshCheckpoints: () => Promise<void>;
  restoreCheckpoint: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULTS },
  loaded: false,
  checkpoints: [],

  load: async () => {
    const api = getBeide();
    let next = { ...DEFAULTS };
    if (api) {
      try {
        next = { ...DEFAULTS, ...(await api.settings.get()) };
      } catch {
        next = { ...DEFAULTS };
      }
    }
    applyTheme(next.theme);
    await setAppLanguage(next.language);
    set({ settings: next, loaded: true });
  },

  update: async (partial) => {
    const api = getBeide();
    const prev = get().settings;
    const optimistic = { ...prev, ...partial };
    set({ settings: optimistic });

    if (partial.theme) applyTheme(partial.theme);
    if (partial.language) await setAppLanguage(partial.language);

    if (!api) return;
    try {
      const saved = await api.settings.set(partial);
      set({ settings: saved });
      applyTheme(saved.theme);
      await setAppLanguage(saved.language);
    } catch {
      set({ settings: prev });
      applyTheme(prev.theme);
      await setAppLanguage(prev.language);
    }
  },

  refreshCheckpoints: async () => {
    const api = getBeide();
    if (!api) {
      set({ checkpoints: [] });
      return;
    }
    try {
      const list = await api.checkpoint.list();
      set({ checkpoints: list });
    } catch {
      set({ checkpoints: [] });
    }
  },

  restoreCheckpoint: async (id) => {
    const api = getBeide();
    if (!api) return;
    await api.checkpoint.restore(id);
    await get().refreshCheckpoints();
  },
}));
