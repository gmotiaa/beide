import { create } from "zustand";
import type { editor as MonacoEditor } from "monaco-editor";
import type { EditorTab } from "../lib/types";
import { getBeide } from "../lib/ipc";
import { fileNameFromPath, languageFromPath } from "../lib/language";

interface EditorState {
  tabs: EditorTab[];
  activePath: string | null;
  /** Tab shown in the right split pane; null = single-editor layout. */
  splitPath: string | null;
  cursorLine: number;
  cursorCol: number;
  monaco: MonacoEditor.IStandaloneCodeEditor | null;
  opening: boolean;
  lastError: string | null;
  /** "file:line [severity] message" lines from Monaco markers, for the agent. */
  diagnostics: string;

  setMonaco: (ed: MonacoEditor.IStandaloneCodeEditor | null) => void;
  setDiagnostics: (text: string) => void;
  setCursor: (line: number, col: number) => void;
  openFile: (path: string) => Promise<void>;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  setSplit: (path: string | null) => void;
  updateContent: (path: string, content: string) => void;
  saveActive: () => Promise<void>;
  savePath: (path: string) => Promise<void>;
  reloadPath: (path: string, discardDirty?: boolean) => Promise<void>;
  markSaved: (path: string, content: string) => void;
  clearError: () => void;
  resetWorkspace: () => void;
  remapPathTree: (oldPath: string, newPath: string) => void;
  closePathTree: (path: string) => void;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function isPathTreeEntry(candidate: string, root: string): boolean {
  const normalizedCandidate = normalizePath(candidate);
  const normalizedRoot = normalizePath(root);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
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

let workspaceEpoch = 0;

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activePath: null,
  splitPath: null,
  cursorLine: 1,
  cursorCol: 1,
  monaco: null,
  opening: false,
  lastError: null,
  diagnostics: "",

  setMonaco: (ed) => set({ monaco: ed }),

  setDiagnostics: (text) => {
    if (get().diagnostics !== text) set({ diagnostics: text });
  },

  setCursor: (line, col) => set({ cursorLine: line, cursorCol: col }),

  clearError: () => set({ lastError: null }),

  resetWorkspace: () => {
    workspaceEpoch += 1;
    set({
      tabs: [],
      activePath: null,
      splitPath: null,
      cursorLine: 1,
      cursorCol: 1,
      monaco: null,
      opening: false,
      lastError: null,
    });
  },

  remapPathTree: (oldPath, newPath) => {
    const oldRoot = normalizePath(oldPath);
    const newRoot = normalizePath(newPath);
    const remap = (path: string): string => {
      const normalized = normalizePath(path);
      if (!isPathTreeEntry(normalized, oldRoot)) return normalized;
      return `${newRoot}${normalized.slice(oldRoot.length)}`;
    };
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (!isPathTreeEntry(tab.path, oldRoot)) return tab;
        const path = remap(tab.path);
        return {
          ...tab,
          path,
          name: fileNameFromPath(path),
          language: languageFromPath(path),
        };
      }),
      activePath: state.activePath ? remap(state.activePath) : null,
      splitPath: state.splitPath ? remap(state.splitPath) : null,
    }));
  },

  closePathTree: (path) => {
    const root = normalizePath(path);
    set((state) => {
      const removed = state.tabs.filter((tab) => isPathTreeEntry(tab.path, root));
      if (!removed.length) return state;
      const tabs = state.tabs.filter((tab) => !isPathTreeEntry(tab.path, root));
      const activePath =
        state.activePath && isPathTreeEntry(state.activePath, root)
          ? (tabs[0]?.path ?? null)
          : state.activePath;
      const splitPath =
        state.splitPath && isPathTreeEntry(state.splitPath, root)
          ? null
          : state.splitPath;
      return { tabs, activePath, splitPath };
    });
  },

  openFile: async (path) => {
    const epoch = workspaceEpoch;
    const normalized = normalizePath(path);
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
      if (epoch !== workspaceEpoch) return;
      const tab = toTab(normalized, content);
      set((s) => ({
        tabs: [...s.tabs.filter((t) => t.path !== tab.path), tab],
        activePath: tab.path,
        opening: false,
        lastError: null,
      }));
    } catch (e) {
      if (epoch !== workspaceEpoch) return;
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
      // Closing the tab that backs the split pane closes the split too.
      const splitPath = s.splitPath === path ? null : s.splitPath;
      return { tabs, activePath, splitPath };
    });
  },

  setActive: (path) => set({ activePath: path }),

  setSplit: (path) => set({ splitPath: path }),

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

  reloadPath: async (path, discardDirty = false) => {
    const epoch = workspaceEpoch;
    const api = getBeide();
    if (!api) return;
    const exists = await api.workspace.pathExists(path);
    if (epoch !== workspaceEpoch) return;
    if (!exists) {
      if (discardDirty || !get().tabs.find((tab) => tab.path === path)?.dirty) {
        get().closeTab(path);
      }
      return;
    }
    const content = await api.workspace.readFile(path);
    if (epoch !== workspaceEpoch) return;
    // Callers check `dirty` before calling; re-check here so keystrokes made
    // while the read was in flight aren't overwritten.
    if (!discardDirty && get().tabs.find((t) => t.path === path)?.dirty) return;
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
