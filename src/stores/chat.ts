import { create } from "zustand";
import type {
  ChatImage,
  ChatMention,
  ChatMessage,
  SessionInfo,
} from "../lib/types";
import { getBeide, uid } from "../lib/ipc";

let saveTimer: ReturnType<typeof setTimeout> | null = null;

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
  pushSystem: (content: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  clear: () => void;
  newSession: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  persistSession: (immediate?: boolean) => void;
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
    get().persistSession();
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
      get().persistSession();
    }
  },

  pushSystem: (content) => {
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: uid("sys"),
          role: "system",
          content,
          createdAt: Date.now(),
        },
      ],
    }));
  },

  setMessages: (messages) => set({ messages }),

  clear: () => set({ messages: [], draft: "", images: [], mentions: [], error: null }),

  newSession: async () => {
    const api = getBeide();
    // Flush current transcript before switching
    get().persistSession(true);
    get().clear();
    if (!api) {
      set({ sessionId: null });
      return;
    }
    try {
      const session = await api.session.new();
      set({ sessionId: session.id });
      await get().refreshSessions();
    } catch {
      set({ sessionId: null });
    }
  },

  loadSession: async (id) => {
    const api = getBeide();
    if (!api) return;
    get().persistSession(true);
    try {
      const messages = await api.session.load(id);
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
    const run = async () => {
      const api = getBeide();
      if (!api) return;
      const { messages, sessionId } = get();
      // Skip empty brand-new chats
      if (!messages.length) return;
      try {
        let id = sessionId;
        if (!id) {
          const session = await api.session.new();
          id = session.id;
          set({ sessionId: id });
        }
        // Strip huge base64 images for disk (keep name only)
        const compact = messages.map((m) => {
          if (!m.images?.length) return m;
          return {
            ...m,
            images: m.images.map((img) => ({
              mimeType: img.mimeType,
              data: img.data.length > 2000 ? "" : img.data,
              name: img.name,
            })),
          };
        });
        await api.session.save(id, compact);
        void get().refreshSessions();
      } catch {
        /* ignore persist errors */
      }
    };

    if (immediate) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      void run();
      return;
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void run();
    }, 600);
  },

  setError: (error) => set({ error }),
}));
