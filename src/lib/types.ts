import type { ModelProvider } from "./models";

export type AgentMode = "plan" | "agent";

/** Whether a model provider has usable credentials, and where they came from. */
export interface ProviderStatus {
  id: ModelProvider;
  label: string;
  connected: boolean;
  /** `oauth` — a subscription login done in pi; `api_key` — a key. */
  kind: "oauth" | "api_key" | null;
}
export type PermissionMode = "ask" | "auto";
export type ThemeId = "dark" | "light" | "midnight";
export type LanguageId = "ru" | "en";

export interface BeideSettings {
  language: LanguageId;
  theme: ThemeId;
  permissionMode: PermissionMode;
  telemetryEnabled: boolean;
  defaultAgentMode: AgentMode;
  modelLabel: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface EditorTab {
  path: string;
  name: string;
  language: string;
  content: string;
  originalContent: string;
  dirty: boolean;
}

export interface ChatImage {
  mimeType: string;
  data: string; // base64 without data: prefix
  name?: string;
}

export interface ChatMention {
  type: "file" | "folder";
  path: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  streaming?: boolean;
  toolName?: string;
  toolStatus?: "running" | "done" | "error";
  /** Short UI subtitle / JSON detail for cards */
  toolDetail?: string;
  /** Structured tool args (preferred over parsing toolDetail) */
  toolArgs?: Record<string, unknown>;
  /** Optional structured tool result payload */
  toolResult?: unknown;
  images?: ChatImage[];
  mentions?: ChatMention[];
  createdAt: number;
}

export interface PermissionRequest {
  id: string;
  kind: "write" | "edit" | "bash";
  path?: string;
  command?: string;
  diff?: string;
  content?: string;
  description: string;
}

export interface CheckpointInfo {
  id: string;
  createdAt: number;
  label: string;
  files: string[];
}

export interface SessionInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  mode: AgentMode;
}

export interface AgentPromptPayload {
  text: string;
  /** Absent → keep the agent's current mode (never defaults to "agent"). */
  mode?: AgentMode;
  mentions: ChatMention[];
  images: ChatImage[];
  activeFile?: string;
  activeFileContent?: string;
  openFiles?: string[];
}

export interface BeideApi {
  workspace: {
    open: () => Promise<string | null>;
    getRoot: () => Promise<string | null>;
    readDir: (path?: string) => Promise<FileNode[]>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    searchFiles: (query: string) => Promise<string[]>;
    pathExists: (path: string) => Promise<boolean>;
    deletePath: (path: string) => Promise<void>;
    renamePath: (path: string, newName: string) => Promise<string>;
    revealInFolder: (path: string) => Promise<void>;
  };
  agent: {
    prompt: (payload: AgentPromptPayload) => Promise<{ ok: boolean; error?: string }>;
    abort: () => Promise<void>;
    setMode: (mode: AgentMode) => Promise<void>;
    setModel: (model: string) => Promise<void>;
    respondPermission: (id: string, allow: boolean, content?: string) => Promise<void>;
    getStatus: () => Promise<{ ready: boolean; streaming: boolean; mode: AgentMode; model?: string }>;
    getProviders: () => Promise<ProviderStatus[]>;
  };
  checkpoint: {
    list: () => Promise<CheckpointInfo[]>;
    restore: (id: string) => Promise<void>;
  };
  settings: {
    get: () => Promise<BeideSettings>;
    set: (partial: Partial<BeideSettings>) => Promise<BeideSettings>;
  };
  session: {
    list: () => Promise<SessionInfo[]>;
    active: () => Promise<string | null>;
    load: (id: string) => Promise<ChatMessage[]>;
    new: () => Promise<SessionInfo>;
    save: (id: string, messages: ChatMessage[]) => Promise<{ ok: boolean }>;
    delete: (id: string) => Promise<{ ok: boolean }>;
  };
  shell: {
    run: (command: string) => Promise<{ code: number; stdout: string; stderr: string }>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  usage: {
    get: () => Promise<{
      plan: "free" | "pro";
      h5: { key: string; endsAt: number; used: number };
      week: { key: string; endsAt: number; used: number };
      credits: number;
    }>;
    increment: (delta: {
      prompts?: number;
      tools?: number;
      tokens?: number;
    }) => Promise<{
      plan: "free" | "pro";
      h5: { key: string; endsAt: number; used: number };
      week: { key: string; endsAt: number; used: number };
      credits: number;
    }>;
  };
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    beide: BeideApi;
  }
}

export {};
