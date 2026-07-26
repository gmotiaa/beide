import { create } from "zustand";
import type { FileNode } from "../lib/types";
import { getBeide } from "../lib/ipc";
import { useAgentStore } from "./agent";

interface WorkspaceState {
  rootPath: string | null;
  tree: FileNode[];
  loading: boolean;
  error: string | null;
  expanded: Record<string, boolean>;
  childrenCache: Record<string, FileNode[]>;

  bootstrap: () => Promise<void>;
  openFolder: () => Promise<void>;
  refreshTree: () => Promise<void>;
  toggleDir: (path: string) => Promise<void>;
  loadChildren: (path: string) => Promise<FileNode[]>;
  searchFiles: (query: string) => Promise<string[]>;
  setRoot: (path: string | null) => void;
  deletePath: (path: string) => Promise<void>;
  renamePath: (path: string, newName: string) => Promise<string>;
  revealInFolder: (path: string) => Promise<void>;
}

async function readRootTree(): Promise<FileNode[]> {
  const api = getBeide();
  if (!api) return [];
  return api.workspace.readDir();
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPath: null,
  tree: [],
  loading: false,
  error: null,
  expanded: {},
  childrenCache: {},

  setRoot: (path) => set({ rootPath: path }),

  bootstrap: async () => {
    const api = getBeide();
    if (!api) return;
    set({ loading: true, error: null });
    try {
      const root = await api.workspace.getRoot();
      if (!root) {
        set({ rootPath: null, tree: [], loading: false });
        return;
      }
      const tree = await readRootTree();
      set({ rootPath: root, tree, loading: false, childrenCache: {}, expanded: {} });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  openFolder: async () => {
    const api = getBeide();
    if (!api) return;
    set({ loading: true, error: null });
    try {
      const root = await api.workspace.open();
      if (!root) {
        set({ loading: false });
        return;
      }
      const tree = await api.workspace.readDir();
      set({
        rootPath: root,
        tree,
        loading: false,
        childrenCache: {},
        expanded: {},
      });
      void useAgentStore.getState().refreshStatus();
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },

  refreshTree: async () => {
    const { rootPath, expanded } = get();
    if (!rootPath) return;
    const api = getBeide();
    if (!api) return;
    try {
      const tree = await api.workspace.readDir();
      // Keep the expanded set: a watcher event must not collapse the tree.
      // Only expanded folders are on screen, so only they need fresh children;
      // the rest lazy-load again when opened.
      const openPaths = Object.keys(expanded).filter((p) => expanded[p]);
      const loaded = await Promise.all(
        openPaths.map(async (p) => {
          try {
            return [p, await api.workspace.readDir(p)] as const;
          } catch {
            return null;
          }
        }),
      );
      const childrenCache: Record<string, FileNode[]> = {};
      for (const entry of loaded) {
        if (entry) childrenCache[entry[0]] = entry[1];
      }
      set({ tree, childrenCache });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  loadChildren: async (path) => {
    const cached = get().childrenCache[path];
    if (cached) return cached;
    const api = getBeide();
    if (!api) return [];
    const children = await api.workspace.readDir(path);
    set((s) => ({
      childrenCache: { ...s.childrenCache, [path]: children },
    }));
    return children;
  },

  toggleDir: async (path) => {
    const { expanded, loadChildren } = get();
    const nextOpen = !expanded[path];
    set({ expanded: { ...expanded, [path]: nextOpen } });
    if (nextOpen) {
      try {
        await loadChildren(path);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    }
  },

  searchFiles: async (query) => {
    const api = getBeide();
    if (!api || !query.trim()) return [];
    try {
      return await api.workspace.searchFiles(query.trim());
    } catch {
      return [];
    }
  },

  deletePath: async (path) => {
    const api = getBeide();
    if (!api) throw new Error("beide API unavailable");
    await api.workspace.deletePath(path);
    // Close tab if open
    const editor = (await import("./editor")).useEditorStore.getState();
    if (editor.tabs.some((t) => t.path === path || t.path.startsWith(path + "/"))) {
      for (const tab of [...editor.tabs]) {
        if (tab.path === path || tab.path.startsWith(path + "/")) {
          editor.closeTab(tab.path);
        }
      }
    }
    await get().refreshTree();
  },

  renamePath: async (path, newName) => {
    const api = getBeide();
    if (!api) throw new Error("beide API unavailable");
    const newPath = await api.workspace.renamePath(path, newName);
    const editor = (await import("./editor")).useEditorStore.getState();
    const tab = editor.tabs.find((t) => t.path === path);
    if (tab) {
      // reload as new path
      editor.closeTab(path);
      void editor.openFile(newPath);
    }
    await get().refreshTree();
    return newPath;
  },

  revealInFolder: async (path) => {
    const api = getBeide();
    if (!api) return;
    await api.workspace.revealInFolder(path);
  },
}));
