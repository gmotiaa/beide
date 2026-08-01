import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  AgentMode,
  AgentPromptPayload,
  BeideApi,
  BeideSettings,
} from "../src/lib/types";

const ALLOWED_EVENTS = new Set([
  "agent:event",
  "agent:permission",
  "workspace:changed",
  "window:close-requested",
  "terminal:data",
  "terminal:exit",
]);

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as
    | { success: true; data: T }
    | { success: false; error: { message: string; code: string } }
    | T;

  if (res && typeof res === "object" && "success" in res) {
    if (res.success) {
      return res.data;
    }
    const err = res.error;
    throw new Error(err?.message || `IPC invocation failed on channel "${channel}"`);
  }
  return res as T;
}

const api: BeideApi = {
  workspace: {
    pickFolder: () => invoke("workspace:pickFolder"),
    setRoot: (path: string) => invoke("workspace:setRoot", path),
    getRoot: () => invoke("workspace:getRoot"),
    readDir: (path?: string) => invoke("workspace:readDir", path),
    readFile: (path: string) => invoke("workspace:readFile", path),
    writeFile: (path: string, content: string) => invoke("workspace:writeFile", path, content),
    searchFiles: (query: string) => invoke("workspace:search", query),
    pathExists: (path: string) => invoke("workspace:pathExists", path),
    deletePath: (path: string) => invoke("workspace:delete", path),
    renamePath: (path: string, newName: string) => invoke("workspace:rename", path, newName),
    revealInFolder: (path: string) => invoke("workspace:reveal", path),
  },
  agent: {
    prompt: (payload: AgentPromptPayload) => invoke("agent:prompt", payload),
    abort: () => invoke("agent:abort"),
    setMode: (mode: AgentMode) => invoke("agent:setMode", mode),
    setModel: (model: string) => invoke("agent:setModel", model),
    respondPermission: (id: string, allow: boolean, content?: string) =>
      invoke("agent:respondPermission", id, allow, content),
    getStatus: () => invoke("agent:getStatus"),
    getProviders: () => invoke("agent:getProviders"),
    installProviderKey: (ciphertext: string) =>
      invoke("agent:installProviderKey", ciphertext),
    health: () => invoke("agent:health"),
  },
  checkpoint: {
    list: () => invoke("checkpoint:list"),
    restore: (id: string) => invoke<string[]>("checkpoint:restore", id),
    entries: (id: string) => invoke("checkpoint:entries", id),
  },
  ai: {
    complete: (payload: {
      prompt: string;
      system?: string;
      model?: string;
      maxTokens?: number;
    }) => invoke("ai:complete", payload),
  },
  git: {
    status: () => invoke("git:status"),
    stage: (path: string) => invoke("git:stage", path),
    unstage: (path: string) => invoke("git:unstage", path),
    diff: (path: string, staged?: boolean) => invoke("git:diff", path, staged),
    commit: (message: string) => invoke("git:commit", message),
  },
  settings: {
    get: () => invoke("settings:get"),
    set: (partial: Partial<BeideSettings>) => invoke("settings:set", partial),
  },
  session: {
    list: () => invoke("session:list"),
    active: () => invoke("session:active"),
    load: (id: string) => invoke("session:load", id),
    new: () => invoke("session:new"),
    save: (id: string, messages: unknown) => invoke("session:save", id, messages),
    import: (info: { id: string; title: string; mode: string }, messages: unknown) =>
      invoke("session:import", info, messages),
    delete: (id: string) => invoke("session:delete", id),
  },
  shell: {
    run: (command: string) => invoke("shell:run", command),
  },
  window: {
    minimize: () => invoke("window:minimize"),
    maximize: () => invoke("window:maximize"),
    close: (discardUnsaved?: boolean) => invoke("window:close", discardUnsaved),
    isMaximized: () => invoke("window:isMaximized"),
    setDirty: (dirty: boolean) => invoke("window:setDirty", dirty),
  },
  terminal: {
    create: (cols: number, rows: number) => invoke("terminal:create", cols, rows),
    write: (id: string, data: string) => invoke("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      invoke("terminal:resize", id, cols, rows),
    kill: (id: string) => invoke("terminal:kill", id),
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_EVENTS.has(channel)) {
      console.warn(`[beide preload] blocked subscription to channel: ${channel}`);
      return () => undefined;
    }
    const handler = (_event: IpcRendererEvent, ...args: unknown[]) => {
      listener(...args);
    };
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  },
};

contextBridge.exposeInMainWorld("beide", api);
