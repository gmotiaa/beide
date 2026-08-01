import { create } from "zustand";
import { DEFAULT_MODEL_ID } from "../lib/models";
import type { BeideSettings, CheckpointInfo, ThemeId } from "../lib/types";
import { getBeide } from "../lib/ipc";
import i18n, { setAppLanguage } from "../i18n";
import { useEditorStore } from "./editor";

export const SETTINGS_DEFAULTS: BeideSettings = {
  language: "ru",
  theme: "dark",
  permissionMode: "ask",
  telemetryEnabled: false,
  defaultAgentMode: "agent",
  modelLabel: DEFAULT_MODEL_ID,
  lastWorkspacePath: null,
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
  /** Back to `SETTINGS_DEFAULTS`, persisted through the same IPC as `update`. */
  reset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...SETTINGS_DEFAULTS },
  loaded: false,
  checkpoints: [],

  load: async () => {
    const api = getBeide();
    let next = { ...SETTINGS_DEFAULTS };
    if (api) {
      try {
        next = { ...SETTINGS_DEFAULTS, ...(await api.settings.get()) };
      } catch {
        next = { ...SETTINGS_DEFAULTS };
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
    const checkpoint = get().checkpoints.find((item) => item.id === id);
    const paths = new Set(checkpoint?.files.map((path) => path.replace(/\\/g, "/")) ?? []);
    const dirtyAffected = useEditorStore
      .getState()
      .tabs.filter((tab) => tab.dirty && paths.has(tab.path.replace(/\\/g, "/")));
    if (
      dirtyAffected.length > 0 &&
      !window.confirm(
        i18n.t("settings.restoreDirtyConfirm", { count: dirtyAffected.length }),
      )
    ) {
      return;
    }
    await api.checkpoint.restore(id);
    await get().refreshCheckpoints();
  },

  // Goes through `update` so theme/language side effects and the optimistic
  // rollback on IPC failure stay in one place.
  reset: async () => {
    await get().update({ ...SETTINGS_DEFAULTS });
  },
}));
