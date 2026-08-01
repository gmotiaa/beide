import { create } from "zustand";
import type {
  BeideApi,
  ChatImage,
  ChatMention,
  ChatMessage,
  SessionInfo,
} from "../lib/types";
import { getBeide, uid } from "../lib/ipc";
import { upsertCloudSession } from "../lib/supabase-sessions";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveChain: Promise<void> = Promise.resolve();

/** Mirrors LIMITS.sessionMessages in main — saving more throws and the whole save is lost. */
const MAX_SAVED_MESSAGES = 2000;

/**
 * Bumped whenever the in-memory transcript is replaced. A save queued for the
 * previous transcript must not land in the session that replaced it.
 */
let transcriptEpoch = 0;

/** Shared in-flight lookup so parallel callers never make two files for one transcript. */
let sessionCreation: Promise<string> | null = null;

/**
 * The id this transcript belongs to. Main already opened a session when it
 * appended the first user message, so asking for it beats minting a second
 * one — that is how a single conversation ended up split across two files,
 * one holding just the prompt and the other the reply.
 */
function adoptOrCreateSession(api: BeideApi): Promise<string> {
  if (!sessionCreation) {
    sessionCreation = api.session
      .active()
      .catch(() => null)
      .then((id) => id ?? api.session.new().then((s) => s.id));
    void sessionCreation.catch(() => undefined).then(() => {
      sessionCreation = null;
    });
  }
  return sessionCreation;
}

/** Strip huge base64 images — an empty payload reloads as a broken <img>. */
function compactForSave(messages: ChatMessage[]): ChatMessage[] {
  const trimmed =
    messages.length > MAX_SAVED_MESSAGES
      ? messages.slice(-MAX_SAVED_MESSAGES)
      : messages;
  return trimmed.map((m) => {
    if (!m.images?.length) return m;
    const images = m.images.filter((img) => img.data.length <= 2000);
    return { ...m, images: images.length ? images : undefined };
  });
}

/**
 * Save an exact transcript rather than "whatever the store holds when this
 * runs". `persistSession(true)` reads the store on a later microtask, so a
 * caller that clears the transcript right after asking for a flush used to
 * save nothing at all and lose the conversation it meant to preserve.
 */
async function saveSnapshot(
  api: BeideApi,
  sessionId: string | null,
  messages: ChatMessage[],
): Promise<string | null> {
  if (!messages.length) return sessionId;
  const id = sessionId ?? (await adoptOrCreateSession(api));
  const compacted = compactForSave(messages);
  await api.session.save(id, compacted);
  // Cloud write-through, strictly after the local write and strictly by
  // value: no store reads here, so transcript epochs are untouched
  // (docs/CHAT-AND-SESSIONS.md invariants 2–3). Fire-and-forget — the local
  // file stays the source of truth when offline.
  void (async () => {
    try {
      const root = await api.workspace.getRoot();
      if (!root) return;
      const info = useChatStore.getState().sessions.find((s) => s.id === id);
      const firstUser = compacted.find((m) => m.role === "user");
      await upsertCloudSession(root, {
        id,
        title: info?.title ?? firstUser?.content.slice(0, 60).trim() ?? "New chat",
        mode: info?.mode ?? "agent",
        messages: compacted,
      });
    } catch {
      /* best-effort backup */
    }
  })();
  return id;
}

/**
 * A transcript restored from disk describes a turn that was interrupted, not
 * one still in flight: nothing is streaming and no tool is mid-run. Real
 * events arriving afterwards address rows by id and revive them anyway.
 */
function settleRestored(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.streaming) return { ...m, streaming: false };
    if (m.role === "tool" && m.toolStatus === "running")
      return { ...m, toolStatus: "done" as const };
    return m;
  });
}

interface ChatState {
  messages: ChatMessage[];
  draft: string;
  images: ChatImage[];
  mentions: ChatMention[];
  sessionId: string | null;
  sessions: SessionInfo[];
  sessionsLoading: boolean;
  error: string | null;

  setDraft: (text: string) => void;
  addImage: (image: ChatImage) => void;
  removeImage: (index: number) => void;
  addMention: (mention: ChatMention) => void;
  clearMentions: () => void;
  appendUserMessage: (content: string, images?: ChatImage[], mentions?: ChatMention[]) => string;
  ensureAssistantStreaming: () => string;
  appendAssistantDelta: (delta: string) => void;
  finalizeAssistant: () => void;
  appendThinkingDelta: (delta: string) => void;
  finalizeThinking: () => void;
  upsertToolMessage: (payload: {
    id?: string;
    toolName: string;
    status: "running" | "done" | "error";
    detail?: string;
    args?: Record<string, unknown>;
    result?: unknown;
  }) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clear: () => void;
  newSession: () => Promise<void>;
  restoreActiveSession: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  persistSession: (immediate?: boolean) => Promise<void>;
  flushBeforeWorkspaceChange: () => Promise<void>;
  resetWorkspace: () => void;
  setError: (error: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  draft: "",
  images: [],
  mentions: [],
  sessionId: null,
  sessions: [],
  sessionsLoading: false,
  error: null,

  setDraft: (text) => set({ draft: text }),

  addImage: (image) => set((s) => ({ images: [...s.images, image] })),

  removeImage: (index) =>
    set((s) => ({ images: s.images.filter((_, i) => i !== index) })),

  addMention: (mention) =>
    set((s) => {
      if (s.mentions.some((m) => m.path === mention.path)) return s;
      return { mentions: [...s.mentions, mention] };
    }),

  clearMentions: () => set({ mentions: [] }),

  appendUserMessage: (content, images, mentions) => {
    const id = uid("user");
    const msg: ChatMessage = {
      id,
      role: "user",
      content,
      images: images?.length ? images : undefined,
      mentions: mentions?.length ? mentions : undefined,
      createdAt: Date.now(),
    };
    set((s) => ({
      messages: [...s.messages, msg],
      draft: "",
      images: [],
      mentions: [],
      error: null,
    }));
    return id;
  },

  ensureAssistantStreaming: () => {
    const msgs = get().messages;
    // Walk from the end. If the latest items are tools, start a NEW assistant
    // bubble AFTER them so post-tool narration doesn't keep editing the top text.
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i];
      if (m.role === "user") break;
      if (m.role === "tool") {
        // Tools are the most recent work → next text is a new segment
        const id = uid("asst");
        const msg: ChatMessage = {
          id,
          role: "assistant",
          content: "",
          streaming: true,
          createdAt: Date.now(),
        };
        set({ messages: [...msgs, msg] });
        return id;
      }
      if (m.role === "assistant") {
        if (!m.streaming) {
          set({
            messages: msgs.map((x, idx) =>
              idx === i ? { ...x, streaming: true } : x,
            ),
          });
        }
        return m.id;
      }
    }
    const id = uid("asst");
    const msg: ChatMessage = {
      id,
      role: "assistant",
      content: "",
      streaming: true,
      createdAt: Date.now(),
    };
    set({ messages: [...msgs, msg] });
    return id;
  },

  appendAssistantDelta: (delta) => {
    if (!delta) return;
    get().ensureAssistantStreaming();
    set((s) => {
      const messages = [...s.messages];
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === "assistant" && m.streaming) {
          messages[i] = { ...m, content: m.content + delta };
          break;
        }
      }
      return { messages };
    });
  },

  finalizeAssistant: () => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.role === "assistant" && m.streaming ? { ...m, streaming: false } : m,
      ),
    }));
    void get().persistSession();
  },

  appendThinkingDelta: (delta) => {
    if (!delta) return;
    set((s) => {
      const idx = s.messages.findIndex(
        (m) =>
          m.role === "tool" &&
          m.toolName === "thinking" &&
          m.toolStatus === "running",
      );
      if (idx >= 0) {
        const messages = [...s.messages];
        const prev = messages[idx];
        const next = (prev.toolDetail ?? prev.content ?? "") + delta;
        messages[idx] = {
          ...prev,
          content: next,
          toolDetail: next,
          toolName: "thinking",
          toolStatus: "running",
        };
        return { messages };
      }
      const msg: ChatMessage = {
        id: uid("thinking"),
        role: "tool",
        content: delta,
        toolName: "thinking",
        toolStatus: "running",
        toolDetail: delta,
        createdAt: Date.now(),
      };
      return { messages: [...s.messages, msg] };
    });
  },

  finalizeThinking: () => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.role === "tool" &&
        m.toolName === "thinking" &&
        m.toolStatus === "running"
          ? { ...m, toolStatus: "done" as const }
          : m,
      ),
    }));
  },

  upsertToolMessage: ({ id, toolName, status, detail, args, result }) => {
    const toolId = id ?? uid("tool");
    set((s) => {
      // Prefer exact toolCallId — never steal another concurrent tool row
      let idx = s.messages.findIndex(
        (m) => m.role === "tool" && m.id === toolId,
      );
      if (idx < 0 && id) {
        // id provided but not found — do not fall back by name (avoids wrong merge)
        idx = -1;
      } else if (idx < 0) {
        // No id (rare): only match a single running tool of this name
        const running = s.messages
          .map((m, i) =>
            m.role === "tool" &&
            m.toolName === toolName &&
            m.toolStatus === "running"
              ? i
              : -1,
          )
          .filter((i) => i >= 0);
        if (running.length === 1) idx = running[0]!;
      }

      if (idx >= 0) {
        const messages = [...s.messages];
        const prev = messages[idx]!;
        const prevDetail = prev.toolDetail ?? prev.content;
        // "готово"/"ok"/"done" are legacy placeholder details from old saved
        // sessions — never a real subtitle, so they must not overwrite one.
        const nextDetail =
          detail && detail !== "готово" && detail !== "ok" && detail !== "done"
            ? detail
            : prevDetail;
        messages[idx] = {
          ...prev,
          id: toolId,
          toolName: toolName || prev.toolName,
          toolStatus: status,
          toolDetail: nextDetail,
          content: nextDetail ?? "",
          toolArgs: args ?? prev.toolArgs,
          toolResult: result !== undefined ? result : prev.toolResult,
        };
        return { messages };
      }

      const msg: ChatMessage = {
        id: toolId,
        role: "tool",
        content: detail ?? "",
        toolName,
        toolStatus: status,
        toolDetail: detail,
        toolArgs: args,
        toolResult: result,
        createdAt: Date.now(),
      };
      return { messages: [...s.messages, msg] };
    });
    if (status === "done" || status === "error") {
      void get().persistSession();
    }
  },

  setMessages: (messages) => {
    transcriptEpoch++;
    set({ messages });
  },

  clear: () => {
    transcriptEpoch++;
    set({ messages: [], draft: "", images: [], mentions: [], error: null });
  },

  flushBeforeWorkspaceChange: async () => {
    const api = getBeide();
    if (!api) return;
    try {
      await api.agent.abort();
    } catch {
      /* best effort; the main workspace transition also tears the runtime down */
    }

    const outgoing = { id: get().sessionId, messages: get().messages };
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const flush = async () => {
      if (!outgoing.messages.length) return;
      await saveSnapshot(api, outgoing.id, outgoing.messages);
    };
    saveChain = saveChain.then(flush, flush);
    try {
      await saveChain;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
      throw e;
    }
  },

  resetWorkspace: () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    transcriptEpoch++;
    sessionCreation = null;
    set({
      messages: [],
      draft: "",
      images: [],
      mentions: [],
      sessionId: null,
      sessions: [],
      sessionsLoading: false,
      error: null,
    });
  },

  newSession: async () => {
    const api = getBeide();
    if (!api) {
      get().clear();
      set({ sessionId: null });
      return;
    }
    // A turn still streaming belongs to the outgoing transcript; its remaining
    // events are dropped by the session filter, so letting it run would only
    // burn tokens. Best-effort — switching must not depend on it.
    try {
      await get().flushBeforeWorkspaceChange();
    } catch {
      // Keep the current transcript visible if it could not be saved.
      return;
    }
    // Create the fresh file BEFORE clearing: if this fails we stay on the
    // current transcript. Clearing first left sessionId null while main still
    // pointed at the old session — the next save adopted it and replaced the
    // old conversation with the new transcript.
    // Deliberately not `adoptOrCreateSession`: this must be a new file, not
    // the session main is still pointing at.
    let created: { id: string };
    try {
      created = await api.session.new();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    get().clear();
    set({ sessionId: created.id });
    await get().refreshSessions();
  },

  restoreActiveSession: async () => {
    const api = getBeide();
    if (!api) return;
    if (get().sessionId) return;
    try {
      const id = await api.session.active();
      if (!id || get().sessionId) return;
      const stored = await api.session.load(id);
      if (get().sessionId) return;
      // A reload can land mid-stream: deltas that arrived while this was in
      // flight are newer than everything on disk, so history goes in front of
      // them instead of replacing them.
      const live = get().messages;
      const seen = new Set(live.map((m) => m.id));
      const history = settleRestored(stored).filter((m) => !seen.has(m.id));
      set({ messages: [...history, ...live], sessionId: id });
    } catch {
      /* nothing to restore */
    }
  },

  loadSession: async (id) => {
    const api = getBeide();
    if (!api) return;
    // Re-loading the open session from disk would wipe live stream deltas.
    if (id === get().sessionId) return;
    // Stop a stream that belongs to the outgoing transcript (see newSession).
    try {
      await api.agent.abort();
    } catch {
      /* ignore */
    }
    try {
      await get().persistSession(true);
      // settleRestored: a transcript loaded from disk describes finished work.
      // A mid-turn save (crash, reload) leaves streaming/running flags in the
      // file — without settling them the tools spin forever in the UI.
      const messages = settleRestored(await api.session.load(id));
      transcriptEpoch++;
      set({ messages, sessionId: id, error: null, draft: "", images: [], mentions: [] });
      await get().refreshSessions();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  refreshSessions: async () => {
    const api = getBeide();
    if (!api) {
      set({ sessions: [] });
      return;
    }
    set({ sessionsLoading: true });
    try {
      const sessions = await api.session.list();
      set({ sessions, sessionsLoading: false });
    } catch {
      set({ sessions: [], sessionsLoading: false });
    }
  },

  persistSession: (immediate = false) => {
    const epoch = transcriptEpoch;
    const run = async () => {
      const api = getBeide();
      if (!api) return;
      // The transcript was replaced while this save waited — it has no home now.
      if (transcriptEpoch !== epoch) return;
      const messages = get().messages;
      // Skip empty brand-new chats
      if (!messages.length) return;
      try {
        const id = await saveSnapshot(api, get().sessionId, messages);
        if (transcriptEpoch !== epoch) return;
        if (id && !get().sessionId) {
          set({ sessionId: id });
          // Refresh only on adoption: refreshing on EVERY debounced save made
          // main re-read the whole sessions dir once per tool call.
          void get().refreshSessions();
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        set({ error: message });
        throw e;
      }
    };

    if (immediate) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      saveChain = saveChain.then(run, run);
      return saveChain;
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveChain = saveChain.then(run, run).catch(() => undefined);
    }, 600);
    return Promise.resolve();
  },

  setError: (error) => set({ error }),
}));
