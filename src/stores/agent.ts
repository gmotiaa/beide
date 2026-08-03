import { create } from "zustand";
import type {
  AgentMode,
  AgentPromptPayload,
  PermissionRequest,
  ProviderStatus,
} from "../lib/types";
import { DEFAULT_MODEL_ID, findModel } from "../lib/models";
import { getBeide, onBeide } from "../lib/ipc";
import i18n from "../i18n";
import { useChatStore } from "./chat";
import { useEditorStore } from "./editor";
import { useSettingsStore } from "./settings";
import { useUsageStore } from "./usage";

/**
 * Agent event shapes we accept from main (flexible — main may send either
 * flat `{ type, ... }` or nested `{ event: string, data }`).
 */
export type AgentEventPayload = {
  type?: string;
  event?: string;
  kind?: string;
  /** Session file the emitting turn belongs to (tagged by main). */
  beideSessionId?: string;
  delta?: string;
  text?: string;
  content?: string;
  message?: string;
  toolName?: string;
  name?: string;
  toolId?: string;
  toolCallId?: string;
  id?: string;
  path?: string;
  detail?: string;
  status?: string;
  error?: string;
  args?: Record<string, unknown>;
  input?: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  data?: Record<string, unknown>;
};

interface AgentState {
  mode: AgentMode;
  streaming: boolean;
  ready: boolean;
  model?: string;
  /** "Provider not responding, attempt N of M" while pi auto-retries. */
  retryNotice: string | null;
  permission: PermissionRequest | null;
  /** Provider credential status; empty until the first refresh resolves. */
  providers: ProviderStatus[];
  providersLoaded: boolean;
  unsub: (() => void) | null;

  init: () => void;
  dispose: () => void;
  setMode: (mode: AgentMode) => Promise<void>;
  setModel: (model: string) => void;
  /** Resolves false when the prompt was NOT dispatched (gate/setup refusal) — callers may restore the draft. */
  send: (text?: string) => Promise<boolean>;
  abort: () => Promise<void>;
  respondPermission: (allow: boolean, content?: string) => Promise<void>;
  handleEvent: (raw: unknown) => void;
  handlePermission: (raw: unknown) => void;
  refreshStatus: () => Promise<void>;
  refreshProviders: () => Promise<void>;
}

function eventType(raw: AgentEventPayload): string {
  const t =
    raw.type ??
    raw.event ??
    raw.kind ??
    (typeof raw.data?.type === "string" ? raw.data.type : undefined) ??
    "";
  return String(t)
    .toLowerCase()
    .replace(/[.\s]+/g, "_")
    .replace(/-/g, "_");
}

function asRecord(v: unknown): AgentEventPayload {
  if (v && typeof v === "object") return v as AgentEventPayload;
  if (typeof v === "string") return { type: "text_delta", delta: v };
  return {};
}

function pickPermission(raw: unknown): PermissionRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = String(r.id ?? "");
  if (!id) return null;
  const kind = (r.kind as PermissionRequest["kind"]) ?? "edit";
  return {
    id,
    kind,
    path: typeof r.path === "string" ? r.path : undefined,
    command: typeof r.command === "string" ? r.command : undefined,
    diff: typeof r.diff === "string" ? r.diff : undefined,
    content: typeof r.content === "string" ? r.content : undefined,
    description:
      typeof r.description === "string"
        ? r.description
        : typeof r.message === "string"
          ? r.message
          : `${kind}`,
  };
}

function asArgs(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

/** Normalize tool args from various pi event shapes */
function extractToolArgs(raw: Record<string, unknown>): Record<string, unknown> {
  const direct = asArgs(raw.args);
  if (Object.keys(direct).length) return direct;
  const input = asArgs(raw.input);
  if (Object.keys(input).length) return input;
  const params = asArgs(raw.parameters);
  if (Object.keys(params).length) return params;
  // Sometimes nested under data
  const data = asArgs(raw.data);
  if (data.args) return asArgs(data.args);
  if (data.input) return asArgs(data.input);
  return {};
}

function extractToolCallId(raw: Record<string, unknown>): string | undefined {
  const id =
    raw.toolCallId ??
    raw.tool_call_id ??
    raw.toolId ??
    raw.id ??
    (raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>).toolCallId
      : undefined);
  return typeof id === "string" && id ? id : undefined;
}

function extractToolName(raw: Record<string, unknown>): string {
  const name =
    raw.toolName ??
    raw.tool_name ??
    raw.name ??
    (raw.data && typeof raw.data === "object"
      ? (raw.data as Record<string, unknown>).toolName
      : undefined);
  return typeof name === "string" && name ? name : "tool";
}

/**
 * System notification when a turn finishes while the window is in the
 * background. Permission is requested lazily on first use; denial (or a
 * platform without Notification) is silently a no-op.
 */
function notifyAgentDone(): void {
  try {
    if (typeof Notification === "undefined") return;
    if (!document.hidden && document.hasFocus()) return;
    const show = () => {
      try {
        new Notification(i18n.t("chat.notificationTitle"), {
          body: i18n.t("chat.agentDoneNotification"),
        });
      } catch {
        /* best-effort */
      }
    };
    if (Notification.permission === "granted") {
      show();
    } else if (Notification.permission === "default") {
      void Notification.requestPermission()
        .then((p) => {
          if (p === "granted") show();
        })
        .catch(() => {
          /* denied or unavailable — never throw */
        });
    }
  } catch {
    /* notifications are best-effort */
  }
}

function previousToolArgs(toolCallId?: string): Record<string, unknown> {
  if (!toolCallId) return {};
  const msgs = useChatStore.getState().messages;
  const m = msgs.find((x) => x.role === "tool" && x.id === toolCallId);
  return m?.toolArgs ?? {};
}

/**
 * Provider-reported cost of the last finished assistant step. Used as the
 * headroom estimate for the next tool gate — the flat 400-token placeholder
 * under-estimated real agentic steps (full history + tool payloads) by an
 * order of magnitude. Module-local: it is a heuristic, not persisted state.
 */
let lastStepTokens = 0;

export const useAgentStore = create<AgentState>((set, get) => ({
  mode: "agent",
  streaming: false,
  ready: false,
  model: undefined,
  retryNotice: null,
  permission: null,
  providers: [],
  providersLoaded: false,
  unsub: null,

  init: () => {
    const prev = get().unsub;
    if (prev) prev();

    const offEvent = onBeide("agent:event", (...args: unknown[]) => {
      get().handleEvent(args[0]);
    });
    const offPerm = onBeide("agent:permission", (...args: unknown[]) => {
      get().handlePermission(args[0]);
    });
    const offWs = onBeide("workspace:changed", () => {
      // soft signal — editor may reload dirty-free tabs elsewhere
    });

    set({
      unsub: () => {
        offEvent();
        offPerm();
        offWs();
      },
    });

    const defaults = useSettingsStore.getState().settings.defaultAgentMode;
    set({ mode: defaults });
    void get().refreshStatus();
    void get().refreshProviders();
  },

  dispose: () => {
    get().unsub?.();
    set({ unsub: null });
  },

  refreshStatus: async () => {
    const api = getBeide();
    if (!api) {
      set({ ready: false, streaming: false });
      return;
    }
    try {
      const status = await api.agent.getStatus();
      // The backend forgets the model between launches — restore the saved one
      // instead of resetting the picker to a hardcoded default.
      const settings = useSettingsStore.getState();
      if (!settings.loaded) await settings.load();
      const savedModel =
        status.model || get().model || useSettingsStore.getState().settings.modelLabel;
      // A saved pick that has since been disabled (gateway lists it but it
      // errors) must not silently stay selected.
      const entry = findModel(savedModel);
      const model = entry && !entry.disabled ? savedModel : DEFAULT_MODEL_ID;
      set({
        ready: status.ready,
        streaming: status.streaming,
        mode: status.mode,
        model,
      });
      if (!status.model) {
        try {
          await api.agent.setModel(model);
        } catch {
          /* non-fatal */
        }
      }
    } catch {
      set({ ready: false });
    }
  },

  refreshProviders: async () => {
    const api = getBeide();
    if (!api) return;
    try {
      set({ providers: await api.agent.getProviders(), providersLoaded: true });
    } catch {
      set({ providers: [], providersLoaded: true });
    }
  },

  setMode: async (mode) => {
    set({ mode });
    const api = getBeide();
    if (!api) return;
    try {
      await api.agent.setMode(mode);
    } catch {
      /* keep local mode */
    }
  },

  setModel: async (model) => {
    set({ model });
    // Survives restarts — the backend does not remember the choice.
    void useSettingsStore.getState().update({ modelLabel: model });
    const api = getBeide();
    if (!api) return;
    try {
      await api.agent.setModel(model);
    } catch {
      /* keep local model */
    }
  },

  send: async (text) => {
    const chat = useChatStore.getState();
    const editor = useEditorStore.getState();
    const content = (text ?? chat.draft).trim();
    const images = [...chat.images];
    const mentions = [...chat.mentions];

    if (!content && images.length === 0) return false;

    // Sending while a turn streams is allowed: main serializes prompts and pi
    // treats them as follow-ups ("followUp" streaming behavior), so the message
    // queues instead of being rejected.

    const api = getBeide();
    if (!api) {
      chat.setError(i18n.t("chat.sendFailed"));
      return false;
    }

    if (!get().ready) await get().refreshStatus();
    if (!get().ready) {
      chat.setError(i18n.t("chat.openProjectFirst"));
      return false;
    }

    if (!get().providersLoaded) await get().refreshProviders();

    if (get().providersLoaded && !get().providers.some((provider) => provider.connected)) {
      chat.setError(i18n.t("chat.noProviderConfigured"));
      return false;
    }

    // Token charge: Supabase when signed in, else local (Electron/userData)
    const usage = useUsageStore.getState();
    let gate: { ok: boolean; reason?: string };
    try {
      gate = await usage.recordPrompt(content || "(image)");
    } catch {
      chat.setError(i18n.t("settings.meteringUnavailable"));
      return false;
    }
    if (!gate.ok) {
      chat.setError(gate.reason ?? i18n.t("settings.chatLimitError"));
      return false;
    }

    // "@codebase <query>" anywhere in the message becomes a codebase mention;
    // main resolves it into content-search results before the prompt.
    const codebaseMatch = content.match(/(?:^|\s)@codebase\s+([^\n]{2,120})/);
    const effectiveMentions = codebaseMatch
      ? [
          ...mentions,
          {
            type: "codebase" as const,
            path: codebaseMatch[1]!.trim(),
            name: "@codebase",
          },
        ]
      : mentions;

    chat.appendUserMessage(content || "(image)", images, effectiveMentions);
    chat.ensureAssistantStreaming();
    set({ streaming: true });

    const payload: AgentPromptPayload = {
      text: content,
      mode: get().mode,
      mentions: effectiveMentions,
      images,
      activeFile: editor.activePath ?? undefined,
      activeFileContent: editor.activePath
        ? editor.tabs.find((tab) => tab.path === editor.activePath)?.content
        : undefined,
      openFiles: editor.tabs.map((t) => t.path),
      diagnostics: editor.diagnostics || undefined,
    };

    try {
      const result = await api.agent.prompt(payload);
      void usage.load();
      if (!result.ok) {
        chat.setError(result.error ?? "send failed");
        chat.appendAssistantDelta(
          result.error
            ? `\n\n**Error:** ${result.error}`
            : "\n\n**Error sending prompt.**",
        );
        chat.finalizeAssistant();
        set({ streaming: false });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      chat.setError(msg);
      chat.appendAssistantDelta(`\n\n**Error:** ${msg}`);
      chat.finalizeAssistant();
      set({ streaming: false });
      void usage.load();
    }
    return true;
  },

  abort: async () => {
    const api = getBeide();
    if (api) {
      try {
        await api.agent.abort();
      } catch {
        /* ignore */
      }
    }
    // Read state only after the await — tools can start or settle during it.
    const chat = useChatStore.getState();
    chat.finalizeThinking();
    // Mark any running tools as interrupted
    for (const m of useChatStore.getState().messages) {
      if (m.role === "tool" && m.toolStatus === "running") {
        chat.upsertToolMessage({
          id: m.id,
          toolName: m.toolName ?? "tool",
          status: "error",
          detail: m.toolDetail || i18n.t("chat.interrupted"),
          args: m.toolArgs,
        });
      }
    }
    chat.finalizeAssistant();
    set({ streaming: false });
  },

  respondPermission: async (allow, content) => {
    const perm = get().permission;
    if (!perm) return;
    const api = getBeide();
    set({ permission: null });
    if (!api) return;
    try {
      await api.agent.respondPermission(perm.id, allow, content);
    } catch {
      /* ignore */
    }
  },

  handlePermission: (raw) => {
    const perm = pickPermission(raw);
    if (perm) set({ permission: perm });
  },

  handleEvent: (raw) => {
    const ev = asRecord(raw);
    const type = eventType(ev);
    const chat = useChatStore.getState();
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

    // A turn keeps streaming after the user switches chats. Its events are
    // tagged with the session they belong to; letting them through appended
    // the tail of the old answer to the newly opened transcript — and the
    // save that followed overwrote that session's file with it. Global
    // status/model/warning events still apply (guarded individually below).
    const evSession = typeof r.beideSessionId === "string" ? r.beideSessionId : null;
    const foreign = Boolean(evSession && chat.sessionId && evSession !== chat.sessionId);
    const globalType =
      type.startsWith("beide") ||
      type === "model_select" ||
      type === "error" ||
      type === "auto_retry_start" ||
      type === "auto_retry_end";
    if (foreign && !globalType) return;

    // pi retries a hung/failed provider request silently for minutes — say so
    // instead of leaving the shimmer spinning with no explanation.
    if (type === "auto_retry_start") {
      const attempt = Number(r.attempt ?? 0) || 1;
      const max = Number(r.maxAttempts ?? 0) || 0;
      set({
        retryNotice: max
          ? i18n.t("chat.providerRetry", { attempt, max })
          : i18n.t("chat.providerRetryNoMax", { attempt }),
      });
      return;
    }

    // pi SDK: message_update + assistantMessageEvent.text_delta
    if (type === "message_update") {
      const ame = (
        raw as {
          assistantMessageEvent?: {
            type?: string;
            delta?: string;
            content?: string;
            text?: string;
          };
        }
      ).assistantMessageEvent;
      const ameType = String(ame?.type ?? "").toLowerCase();
      if (ameType === "text_delta" || ameType === "text") {
        const delta =
          typeof ame?.delta === "string"
            ? ame.delta
            : typeof ame?.text === "string"
              ? ame.text
              : typeof ame?.content === "string"
                ? ame.content
                : "";
        if (delta) {
          chat.finalizeThinking();
          chat.appendAssistantDelta(delta);
          // Bytes are flowing again — the retry (if any) succeeded.
          set({ streaming: true, retryNotice: null });
        }
        return;
      }
      // pi emits thinking_start → thinking_delta* → thinking_end, where
      // thinking_end carries `content` with the WHOLE thought. Appending that
      // on top of the deltas printed the entire reasoning block twice.
      if (ameType === "thinking_delta") {
        if (typeof ame?.delta === "string" && ame.delta) {
          chat.appendThinkingDelta(ame.delta);
          set({ streaming: true });
        }
        return;
      }
      if (ameType === "thinking_end") {
        chat.finalizeThinking();
        return;
      }
      return;
    }

    if (
      type === "message_start" ||
      type === "agent_start" ||
      type === "turn_start" ||
      type === "before_agent_start"
    ) {
      chat.ensureAssistantStreaming();
      set({ streaming: true });
      return;
    }

    if (
      type === "message_end" ||
      type === "turn_end" ||
      type === "agent_end" ||
      type === "agent_settled"
    ) {
      // Don't finalize on message_end alone — agent may continue with tools.
      if (type === "agent_end" || type === "agent_settled") {
        chat.finalizeThinking();
        // Close any stuck running tools
        for (const m of chat.messages) {
          if (m.role === "tool" && m.toolStatus === "running" && m.toolName !== "thinking") {
            chat.upsertToolMessage({
              id: m.id,
              toolName: m.toolName ?? "tool",
              status: "done",
              detail: m.toolDetail,
              args: m.toolArgs,
              result: m.toolResult,
            });
          }
        }
        chat.finalizeAssistant();
        set({ streaming: false, retryNotice: null });
        void get().refreshStatus();
        // Foreign-session events never reach this point (filtered above), so
        // this only announces the turn the user is actually waiting on.
        notifyAgentDone();
      }
      return;
    }

    // Early tool preview (before execution) — same UI as start
    if (type === "tool_call") {
      const toolCallId = extractToolCallId(r);
      const toolName = extractToolName(r);
      const args = extractToolArgs(r);
      chat.finalizeThinking();
      chat.finalizeAssistant();
      chat.upsertToolMessage({
        id: toolCallId,
        toolName,
        status: "running",
        detail: formatToolDetail(toolName, args),
        args,
      });
      set({ streaming: true });
      return;
    }

    if (type === "tool_execution_start") {
      const toolCallId = extractToolCallId(r);
      const toolName = extractToolName(r);
      const args = extractToolArgs(r);
      chat.finalizeThinking();
      chat.finalizeAssistant();
      chat.upsertToolMessage({
        id: toolCallId,
        toolName,
        status: "running",
        detail: formatToolDetail(toolName, args),
        args,
      });
      // Tool charges are gated too: past the limit the turn is aborted instead
      // of silently running (and charging) an unbounded tool loop.
      void useUsageStore
        .getState()
        .recordTools(1, lastStepTokens)
        .then((gate) => {
          if (!gate.ok) {
            useChatStore.getState().setError(gate.reason ?? "");
            void get().abort();
          }
        });
      set({ streaming: true });
      return;
    }

    if (type === "tool_execution_update") {
      const toolCallId = extractToolCallId(r);
      const toolName = extractToolName(r);
      const args = {
        ...previousToolArgs(toolCallId),
        ...extractToolArgs(r),
      };
      // Keep running; refresh detail if we learned more
      const detail = formatToolDetail(toolName, args, r.partialResult);
      chat.upsertToolMessage({
        id: toolCallId,
        toolName,
        status: "running",
        detail,
        args,
        result: r.partialResult,
      });
      return;
    }

    if (type === "tool_execution_end" || type === "tool_result") {
      const toolCallId = extractToolCallId(r);
      const toolName = extractToolName(r);
      const prevArgs = previousToolArgs(toolCallId);
      const args = { ...prevArgs, ...extractToolArgs(r) };
      const isError = Boolean(r.isError ?? r.error);
      const result = r.result ?? r.output ?? r.data;
      // No placeholder detail on errors — status "error" already renders as
      // such, and a literal string here becomes protocol the UI must filter.
      const detail = formatToolDetail(toolName, args, result);
      chat.upsertToolMessage({
        id: toolCallId,
        toolName,
        status: isError ? "error" : "done",
        detail,
        args,
        result,
      });
      // After write/edit, soft-reload open dirty-free tabs is handled via workspace:changed
      return;
    }

    // Provider-reported usage for a finished assistant message — the real
    // charge (account-level, so the session filter does not apply).
    if (type === "beide_usage" || type === "beide:usage") {
      const tokens = Number(r.tokens);
      if (Number.isFinite(tokens) && tokens > 0) {
        lastStepTokens = tokens;
        // The server ledger is the authority: when spend_tokens refuses the
        // charge (windows AND credits exhausted), the turn must stop — a
        // banner alone let multi-step runs keep burning tokens past the limit.
        void useUsageStore
          .getState()
          .spendActual(tokens)
          .then((res) => {
            if (!res.ok && get().streaming) {
              useChatStore
                .getState()
                .setError(res.reason ?? i18n.t("settings.chatLimitError"));
              void get().abort();
            }
          });
      }
      return;
    }

    if (type === "beide_status" || type === "beide:status") {
      const status = r as {
        streaming?: boolean;
        mode?: AgentMode;
        model?: string;
        aborted?: boolean;
      };
      if (typeof status.streaming === "boolean") set({ streaming: status.streaming });
      if (status.mode) set({ mode: status.mode });
      if (status.model) set({ model: status.model });
      if (status.streaming === false) {
        chat.finalizeThinking();
        chat.finalizeAssistant();
        set({ retryNotice: null });
      }
      return;
    }

    if (type === "beide_model" || type === "beide:model" || type === "model_select") {
      const model =
        typeof r.model === "string"
          ? r.model
          : r.model && typeof r.model === "object"
            ? `${(r.model as { provider?: string }).provider ?? ""}/${(r.model as { id?: string }).id ?? ""}`.replace(
                /^\/|\/$/g,
                "",
              )
            : undefined;
      if (model) set({ model });
      return;
    }

    if (type === "beide_warning" || type === "beide:warning") {
      const msg = String(r.message ?? r.description ?? "");
      if (msg) {
        chat.setError(msg);
        // A warning from another session's turn must not write into the open
        // transcript — the banner above is enough.
        if (!foreign) {
          chat.appendAssistantDelta(`\n\n**⚠️ ${msg}**`);
          chat.finalizeAssistant();
          set({ streaming: false });
        }
      }
      return;
    }

    if (type === "error" || type === "auto_retry_end") {
      set({ retryNotice: null });
      if (type === "auto_retry_end" && (r as { success?: boolean }).success) return;
      const err = String(
        r.error ?? r.errorMessage ?? r.finalError ?? "Agent error",
      );
      chat.setError(err);
      if (!foreign) {
        chat.appendAssistantDelta(`\n\n**Error:** ${err}`);
        chat.finalizeThinking();
        chat.finalizeAssistant();
        set({ streaming: false });
      }
      return;
    }

    // Fallback: loose shapes from older notes
    if (type.includes("delta") && typeof ev.delta === "string") {
      chat.appendAssistantDelta(ev.delta);
      set({ streaming: true });
    }
  },
}));

/** Compact, UI-friendly tool subtitle / structured JSON for cards */
function formatToolDetail(
  toolName: string,
  args: Record<string, unknown>,
  result?: unknown,
): string {
  const key = toolName.trim().toLowerCase();

  if (key === "todo" || key === "todowrite") {
    const todos =
      (Array.isArray(args.todos) && args.todos) ||
      (result &&
      typeof result === "object" &&
      Array.isArray((result as { details?: { todos?: unknown } }).details?.todos)
        ? (result as { details: { todos: unknown[] } }).details.todos
        : null) ||
      (result &&
      typeof result === "object" &&
      Array.isArray((result as { todos?: unknown }).todos)
        ? (result as { todos: unknown[] }).todos
        : null);
    if (todos) {
      try {
        return JSON.stringify({ todos });
      } catch {
        /* fall through */
      }
    }
  }

  if (key === "plan" || key === "planwrite") {
    const title = typeof args.title === "string" ? args.title : "";
    const summary = typeof args.summary === "string" ? args.summary : "";
    if (title || summary) {
      return JSON.stringify({
        plan: {
          id: typeof args.id === "string" ? args.id : "plan",
          title: title || "План",
          summary,
        },
      });
    }
    if (result && typeof result === "object") {
      const details = (result as { details?: unknown }).details ?? result;
      try {
        return JSON.stringify(details).slice(0, 4000);
      } catch {
        /* fall through */
      }
    }
  }

  if (key === "git_status" || key === "gitstatus") {
    if (typeof args.scope === "string") return args.scope;
    return "git status";
  }

  if (key === "workspace_map" || key === "workspacemap") {
    return typeof args.path === "string" && args.path ? args.path : "workspace";
  }

  if (key === "project_info" || key === "projectinfo") {
    return "package.json";
  }

  const pathLike =
    args.path ?? args.file_path ?? args.filePath ?? args.filename ?? args.target;
  const cmd = args.command ?? args.cmd;
  const pattern =
    args.pattern ?? args.query ?? args.glob ?? args.include ?? args.regex;

  if (typeof pathLike === "string" && pathLike) return pathLike;
  if (typeof cmd === "string" && cmd) return cmd;
  if (typeof pattern === "string" && pattern) {
    if (typeof pathLike === "string" && pathLike) {
      return `${pattern} · ${pathLike}`;
    }
    return pattern;
  }

  if (result && typeof result === "object") {
    try {
      const details = (result as { details?: unknown }).details ?? result;
      if (details && typeof details === "object") {
        const o = details as Record<string, unknown>;
        const p =
          o.path ?? o.file_path ?? o.filePath ?? o.command ?? o.cmd ?? o.pattern;
        if (typeof p === "string" && p) return p;
      }
      if (typeof details === "string") {
        return details.length > 200 ? `${details.slice(0, 200)}…` : details;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const compact: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      if (typeof v === "string" && v.length < 200) compact[k] = v;
      else if (typeof v === "number" || typeof v === "boolean") compact[k] = v;
    }
    return Object.keys(compact).length ? JSON.stringify(compact) : "";
  } catch {
    return "";
  }
}
