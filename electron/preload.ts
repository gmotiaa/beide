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
]);

const api: BeideApi = {
  workspace: {
    open: () => ipcRenderer.invoke("workspace:open"),
    getRoot: () => ipcRenderer.invoke("workspace:getRoot"),
    readDir: (path?: string) => ipcRenderer.invoke("workspace:readDir", path),
    readFile: (path: string) => ipcRenderer.invoke("workspace:readFile", path),
    writeFile: (path: string, content: string) =>
      ipcRenderer.invoke("workspace:writeFile", path, content),
    searchFiles: (query: string) => ipcRenderer.invoke("workspace:search", query),
    pathExists: (path: string) => ipcRenderer.invoke("workspace:pathExists", path),
    deletePath: (path: string) => ipcRenderer.invoke("workspace:delete", path),
    renamePath: (path: string, newName: string) =>
      ipcRenderer.invoke("workspace:rename", path, newName),
    revealInFolder: (path: string) => ipcRenderer.invoke("workspace:reveal", path),
  },
  agent: {
    prompt: (payload: AgentPromptPayload) => ipcRenderer.invoke("agent:prompt", payload),
    abort: () => ipcRenderer.invoke("agent:abort"),
    setMode: (mode: AgentMode) => ipcRenderer.invoke("agent:setMode", mode),
    respondPermission: (id: string, allow: boolean, content?: string) =>
      ipcRenderer.invoke("agent:respondPermission", id, allow, content),
    getStatus: () => ipcRenderer.invoke("agent:getStatus"),
  },
  checkpoint: {
    list: () => ipcRenderer.invoke("checkpoint:list"),
    restore: (id: string) => ipcRenderer.invoke("checkpoint:restore", id),
  },
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (partial: Partial<BeideSettings>) => ipcRenderer.invoke("settings:set", partial),
  },
  session: {
    list: () => ipcRenderer.invoke("session:list"),
    load: (id: string) => ipcRenderer.invoke("session:load", id),
    new: () => ipcRenderer.invoke("session:new"),
    save: (id: string, messages: unknown) =>
      ipcRenderer.invoke("session:save", id, messages),
    delete: (id: string) => ipcRenderer.invoke("session:delete", id),
  },
  shell: {
    run: (command: string) => ipcRenderer.invoke("shell:run", command),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize") as Promise<boolean>,
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () =>
      ipcRenderer.invoke("window:isMaximized") as Promise<boolean>,
  },
  usage: {
    get: () => ipcRenderer.invoke("usage:get"),
    setPlan: (plan) => ipcRenderer.invoke("usage:setPlan", plan),
    increment: (delta) => ipcRenderer.invoke("usage:increment", delta),
    resetToday: () => ipcRenderer.invoke("usage:resetToday"),
  },
  authAdminSignUp: (email: string, password: string) =>
    ipcRenderer.invoke("auth:adminSignUp", email, password),
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
