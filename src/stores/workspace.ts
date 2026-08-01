import { create } from "zustand";
import type { BeideApi, FileNode } from "../lib/types";
import { getBeide } from "../lib/ipc";
import {
  fetchUserSettingsCloud,
  saveUserSettingsCloud,
} from "../lib/supabase-settings";
import i18n from "../i18n";
import { useAgentStore } from "./agent";
import { useChatStore } from "./chat";
import { useEditorStore } from "./editor";

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
  deletePath: (path: string, discardDirty?: boolean) => Promise<void>;
  renamePath: (path: string, newName: string) => Promise<string>;
  revealInFolder: (path: string) => Promise<void>;
}

async function readRootTree(): Promise<FileNode[]> {
  const api = getBeide();
  if (!api) return [];
  return api.workspace.readDir();
}

function sameRoot(a: string | null, b: string): boolean {
  if (!a) return false;
  const normalize = (value: string) =>
    value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * Reopen the workspace from the previous launch: local settings first, the
 * cloud copy as fallback (fresh machine, same account). `setRoot` itself
 * validates the directory still exists — a moved/deleted folder just leaves
 * the app on the empty state.
 */
async function restoreLastWorkspace(api: BeideApi): Promise<string | null> {
  try {
    let last = (await api.settings.get()).lastWorkspacePath;
    if (!last) {
      last = (await fetchUserSettingsCloud())?.last_workspace_path ?? null;
    }
    if (!last) return null;
    return await api.workspace.setRoot(last);
  } catch {
    return null;
  }
}

function pathContains(candidate: string, root: string): boolean {
  const normalizedCandidate = candidate.replace(/\\/g, "/");
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}/`)
  );
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
      let root = await api.workspace.getRoot();
      let restored = false;
      if (!root) {
        root = await restoreLastWorkspace(api);
        restored = Boolean(root);
      }
      if (!root) {
        set({ rootPath: null, tree: [], loading: false });
        return;
      }
      const tree = await readRootTree();
      set({ rootPath: root, tree, loading: false, childrenCache: {}, expanded: {} });
      if (restored) {
        // ChatPanel mounted before the root existed, so its own restore call
        // found nothing — re-run it now that main knows the workspace.
        void useChatStore.getState().restoreActiveSession();
        void useChatStore.getState().refreshSessions();
        void useAgentStore.getState().refreshStatus();
      }
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
    try {
      const selected = await api.workspace.pickFolder();
      if (!selected || sameRoot(get().rootPath, selected)) return;

      const editor = useEditorStore.getState();
      if (
        editor.tabs.some((tab) => tab.dirty) &&
        !window.confirm(i18n.t("editor.changeWorkspaceUnsavedConfirm"))
      ) {
        return;
      }

      // This must finish while main still points at the outgoing workspace;
      // otherwise the transcript would be written into the new project's
      // `.beide/sessions` directory.
      await useChatStore.getState().flushBeforeWorkspaceChange();
      set({ loading: true, error: null });
      const root = await api.workspace.setRoot(selected);
      useEditorStore.getState().resetWorkspace();
      useChatStore.getState().resetWorkspace();
      const tree = await api.workspace.readDir();
      set({
        rootPath: root,
        tree,
        loading: false,
        childrenCache: {},
        expanded: {},
      });
      void useAgentStore.getState().refreshStatus();
      // Cloud copy of the last workspace — restores on a fresh machine.
      void saveUserSettingsCloud({ last_workspace_path: root });
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

  deletePath: async (path, discardDirty = false) => {
    const api = getBeide();
    if (!api) throw new Error("beide API unavailable");
    const editor = useEditorStore.getState();
    const dirty = editor.tabs.filter(
      (tab) => tab.dirty && pathContains(tab.path, path),
    );
    if (dirty.length && !discardDirty) {
      throw new Error(i18n.t("fileTree.unsavedDeleteBlocked"));
    }
    await api.workspace.deletePath(path);
    editor.closePathTree(path);
    await get().refreshTree();
  },

  renamePath: async (path, newName) => {
    const api = getBeide();
    if (!api) throw new Error("beide API unavailable");
    const newPath = await api.workspace.renamePath(path, newName);
    // Preserve both saved and dirty buffers, including every descendant when a
    // directory moves. Reloading from disk here discarded unsaved edits.
    useEditorStore.getState().remapPathTree(path, newPath);
    await get().refreshTree();
    return newPath;
  },

  revealInFolder: async (path) => {
    const api = getBeide();
    if (!api) return;
    await api.workspace.revealInFolder(path);
  },
}));
