import type { ModelProvider } from "./models";
import type { UsagePlanId, UsageStateData } from "./usage";

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
export type LanguageId = "ru" | "en" | "be";

export interface BeideSettings {
  language: LanguageId;
  theme: ThemeId;
  permissionMode: PermissionMode;
  telemetryEnabled: boolean;
  defaultAgentMode: AgentMode;
  modelLabel: string;
  /** Reopened on the next launch; null after the user closes the workspace. */
  lastWorkspacePath: string | null;
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
  /** "codebase" carries a search query in `path` (lexical content search). */
  type: "file" | "folder" | "codebase";
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
  /** Editor diagnostics ("file:line message" lines) for open tabs. */
  diagnostics?: string;
  /** Resolved @codebase search results, filled in by main's IPC handler. */
  codebaseContext?: string;
}

export interface BeideApi {
  workspace: {
    pickFolder: () => Promise<string | null>;
    setRoot: (path: string) => Promise<string>;
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
    setAccessToken: (token: string) => Promise<{ ok: boolean }>;
    health: () => Promise<{ ok: boolean; latencyMs: number | null }>;
  };
  ai: {
    complete: (payload: {
      prompt: string;
      system?: string;
      model?: string;
      maxTokens?: number;
    }) => Promise<{ ok: boolean; text?: string; error?: string }>;
  };
  git: {
    status: () => Promise<{ isRepo: boolean; branch: string | null; status: string }>;
    stage: (path: string) => Promise<{ code: number; stdout: string; stderr: string }>;
    unstage: (path: string) => Promise<{ code: number; stdout: string; stderr: string }>;
    diff: (path: string, staged?: boolean) => Promise<{ diff: string }>;
    commit: (message: string) => Promise<{ code: number; stdout: string; stderr: string }>;
  };
  checkpoint: {
    list: () => Promise<CheckpointInfo[]>;
    restore: (id: string) => Promise<string[]>;
    entries: (id: string) => Promise<
      Array<{
        path: string;
        existed: boolean;
        before: string | null;
        after: string | null;
        binary: boolean;
      }>
    >;
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
    import: (
      info: { id: string; title: string; mode: AgentMode },
      messages: ChatMessage[],
    ) => Promise<{ ok: boolean }>;
    delete: (id: string) => Promise<{ ok: boolean }>;
  };
  shell: {
    run: (command: string) => Promise<{ code: number; stdout: string; stderr: string }>;
  };
  terminal: {
    create: (cols: number, rows: number, shellId?: string) => Promise<{ id: string }>;
    write: (id: string, data: string) => Promise<{ ok: boolean }>;
    resize: (id: string, cols: number, rows: number) => Promise<{ ok: boolean }>;
    kill: (id: string) => Promise<{ ok: boolean }>;
    shells: () => Promise<Array<{ id: string; label: string; path: string }>>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<boolean>;
    close: (discardUnsaved?: boolean) => Promise<void>;
    isMaximized: () => Promise<boolean>;
    setDirty: (dirty: boolean) => Promise<void>;
  };
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    beide: BeideApi;
  }
}

export {};
