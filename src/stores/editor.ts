import { create } from "zustand";
import type { editor as MonacoEditor } from "monaco-editor";
import type { EditorTab } from "../lib/types";
import { getBeide } from "../lib/ipc";
import { fileNameFromPath, languageFromPath } from "../lib/language";

interface EditorState {
  tabs: EditorTab[];
  activePath: string | null;
  cursorLine: number;
  cursorCol: number;
  monaco: MonacoEditor.IStandaloneCodeEditor | null;
  opening: boolean;
  lastError: string | null;

  setMonaco: (ed: MonacoEditor.IStandaloneCodeEditor | null) => void;
  setCursor: (line: number, col: number) => void;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  saveActive: () => Promise<void>;
  savePath: (path: string) => Promise<void>;
  reloadPath: (path: string) => Promise<void>;
  markSaved: (path: string, content: string) => void;
  clearError: () => void;
}

function toTab(path: string, content: string): EditorTab {
  return {
    path,
    name: fileNameFromPath(path),
    language: languageFromPath(path),
    content,
    originalContent: content,
    dirty: false,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activePath: null,
  cursorLine: 1,
  cursorCol: 1,
  monaco: null,
  opening: false,
  lastError: null,

  setMonaco: (ed) => set({ monaco: ed }),

  setCursor: (line, col) => set({ cursorLine: line, cursorCol: col }),

  clearError: () => set({ lastError: null }),

  openFile: async (path) => {
    const normalized = path.replace(/\\/g, "/");
    const existing = get().tabs.find((t) => t.path === normalized || t.path === path);
    if (existing) {
      set({ activePath: existing.path, lastError: null });
      return;
    }
    const api = getBeide();
    if (!api) {
      set({ lastError: "window.beide unavailable — restart the app" });
      console.error("[beide] openFile: no window.beide");
      return;
    }
    set({ opening: true, lastError: null });
    try {
      const content = await api.workspace.readFile(normalized);
      const tab = toTab(normalized, content);
      set((s) => ({
        tabs: [...s.tabs.filter((t) => t.path !== tab.path), tab],
        activePath: tab.path,
        opening: false,
        lastError: null,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[beide] openFile failed", normalized, e);
      set({ opening: false, lastError: `Cannot open ${normalized}: ${msg}` });
    }
  },

  closeTab: (path) => {
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path);
      let activePath = s.activePath;
      if (activePath === path) {
        const idx = s.tabs.findIndex((t) => t.path === path);
        const neighbor = tabs[Math.min(idx, tabs.length - 1)] ?? null;
        activePath = neighbor?.path ?? null;
      }
      return { tabs, activePath };
    });
  },

  setActive: (path) => set({ activePath: path }),

  updateContent: (path, content) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path
          ? { ...t, content, dirty: content !== t.originalContent }
          : t,
      ),
    }));
  },

  /**
   * `savedContent` is what actually reached disk. The buffer is left alone —
   * keystrokes made while the write was in flight must survive — and `dirty` is
   * recomputed against what was written.
   */
  markSaved: (path, savedContent) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path
          ? {
              ...t,
              originalContent: savedContent,
              dirty: t.content !== savedContent,
            }
          : t,
      ),
    }));
  },

  savePath: async (path) => {
    const tab = get().tabs.find((t) => t.path === path);
    if (!tab || !tab.dirty) return;
    const api = getBeide();
    if (!api) return;
    const written = tab.content;
    try {
      await api.workspace.writeFile(path, written);
    } catch (e) {
      // Ctrl+S callers fire-and-forget; without this a locked/readonly file
      // failed silently — tab stayed dirty with no indication why.
      const msg = e instanceof Error ? e.message : String(e);
      set({ lastError: `Cannot save ${path}: ${msg}` });
      return;
    }
    get().markSaved(path, written);
    set({ lastError: null });
  },

  saveActive: async () => {
    const { activePath, savePath } = get();
    if (!activePath) return;
    await savePath(activePath);
  },

  reloadPath: async (path) => {
    const api = getBeide();
    if (!api) return;
    const content = await api.workspace.readFile(path);
    // Callers check `dirty` before calling; re-check here so keystrokes made
    // while the read was in flight aren't overwritten.
    if (get().tabs.find((t) => t.path === path)?.dirty) return;
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path
          ? {
              ...t,
              content,
              originalContent: content,
              dirty: false,
              language: languageFromPath(path),
            }
          : t,
      ),
    }));
  },
}));
