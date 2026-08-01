import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentMode, ChatMessage, SessionInfo } from "../../src/lib/types";
import { getSessionsDir } from "./paths";
import { asChatMessages } from "./ipc-utils";

interface SessionFile {
  info: SessionInfo;
  messages: ChatMessage[];
}

const ID_RE = /^[a-z0-9_-]+$/i;
const MAX_MESSAGES = 2_000;
const MAX_SESSIONS = 80;
const MAX_SESSION_FILE_CHARS = 16_000_000;

function assertSafeId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new Error(`Invalid session id: ${id}`);
  }
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, path);
}

function clampMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages;
  // Keep newest tail
  return messages.slice(messages.length - MAX_MESSAGES);
}

/**
 * Mirror of the renderer's `compactForSave`: big base64 blobs must never reach
 * disk. The renderer strips them before `session:save`, but `appendMessages`
 * (main's own writer, used for the prompt's user message) did not — a few
 * photo-sized images pushed the file past MAX_SESSION_FILE_CHARS and every
 * later read of the session threw, splitting the conversation into a new file.
 */
const MAX_SAVED_IMAGE_CHARS = 2_000;

function compactImages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (!m.images?.length) return m;
    const images = m.images.filter((img) => img.data.length <= MAX_SAVED_IMAGE_CHARS);
    return { ...m, images: images.length ? images : undefined };
  });
}

function parseSessionInfo(value: unknown): SessionInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid session info");
  }
  const info = value as Record<string, unknown>;
  const id = typeof info.id === "string" ? info.id : "";
  assertSafeId(id);
  if (
    typeof info.title !== "string" ||
    typeof info.createdAt !== "number" ||
    !Number.isFinite(info.createdAt) ||
    typeof info.updatedAt !== "number" ||
    !Number.isFinite(info.updatedAt) ||
    (info.mode !== "plan" && info.mode !== "agent")
  ) {
    throw new Error(`Invalid session metadata: ${id}`);
  }
  return {
    id,
    title: info.title.slice(0, 200),
    createdAt: info.createdAt,
    updatedAt: info.updatedAt,
    mode: info.mode,
  };
}

async function readSessionFile(path: string): Promise<SessionFile> {
  const raw = await readFile(path, "utf-8");
  if (raw.length > MAX_SESSION_FILE_CHARS) {
    throw new Error(`Session file too large: ${path}`);
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid session file: ${path}`);
  }
  const data = parsed as Record<string, unknown>;
  return {
    info: parseSessionInfo(data.info),
    messages: asChatMessages(data.messages, "messages", MAX_MESSAGES),
  };
}

export class SessionService {
  private workspaceRoot: string | null = null;
  private activeId: string | null = null;
  private mutationChain: Promise<void> = Promise.resolve();
  /**
   * Resolves once the persisted active id for the current workspace has been
   * read back. Readers that mint sessions (or report the active one) await it
   * so a fast first prompt after launch does not fork a fresh file while the
   * previous conversation was about to be restored.
   */
  private restorePromise: Promise<void> = Promise.resolve();

  private enqueueMutation<T>(run: () => Promise<T>): Promise<T> {
    const next = this.mutationChain.then(run, run);
    this.mutationChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  setWorkspace(root: string | null): void {
    this.workspaceRoot = root;
    this.activeId = null;
    this.restorePromise = root
      ? this.loadPersistedActiveId(root).catch(() => undefined)
      : Promise.resolve();
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  /** IPC-facing variant that waits for the persisted id to be restored. */
  async getActiveIdSettled(): Promise<string | null> {
    await this.restorePromise;
    return this.activeId;
  }

  /** `<workspace>/.beide/active-session.json` — survives full app restarts. */
  private activeIdFilePath(root: string): string {
    return join(dirname(getSessionsDir(root)), "active-session.json");
  }

  private async loadPersistedActiveId(root: string): Promise<void> {
    const raw = await readFile(this.activeIdFilePath(root), "utf-8");
    const parsed = JSON.parse(raw) as { id?: unknown };
    const id = typeof parsed.id === "string" ? parsed.id : "";
    assertSafeId(id);
    // The session may have been pruned or deleted since it was remembered.
    await stat(join(getSessionsDir(root), `${id}.json`));
    // The workspace may have changed while we were reading.
    if (this.workspaceRoot === root && this.activeId === null) {
      this.activeId = id;
    }
  }

  private persistActiveId(): void {
    const root = this.workspaceRoot;
    if (!root) return;
    const path = this.activeIdFilePath(root);
    const write = async () => {
      if (this.activeId) {
        await mkdir(dirname(path), { recursive: true });
        await writeJsonAtomic(path, { id: this.activeId });
      } else {
        await rm(path, { force: true });
      }
    };
    void write().catch(() => undefined);
  }

  private requireRoot(): string {
    if (!this.workspaceRoot) throw new Error("No workspace open");
    return this.workspaceRoot;
  }

  private dir(): string {
    return getSessionsDir(this.requireRoot());
  }

  private filePath(id: string): string {
    assertSafeId(id);
    return join(this.dir(), `${id}.json`);
  }

  async list(): Promise<SessionInfo[]> {
    if (!this.workspaceRoot) return [];
    await this.mutationChain;
    let names: string[];
    try {
      names = await readdir(this.dir());
    } catch {
      return [];
    }
    const out: SessionInfo[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const data = await readSessionFile(join(this.dir(), name));
        if (data.info) out.push(data.info);
      } catch {
        // skip
      }
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  }

  async load(id: string): Promise<ChatMessage[]> {
    await this.mutationChain;
    const data = await readSessionFile(this.filePath(id));
    if (data.info.id !== id) throw new Error(`Session id mismatch: ${id}`);
    this.activeId = id;
    this.persistActiveId();
    return data.messages;
  }

  async create(mode: AgentMode = "agent", title = "New chat"): Promise<SessionInfo> {
    return this.enqueueMutation(() => this.createUnlocked(mode, title));
  }

  private async createUnlocked(
    mode: AgentMode = "agent",
    title = "New chat",
  ): Promise<SessionInfo> {
    const root = this.requireRoot();
    await mkdir(getSessionsDir(root), { recursive: true });
    const now = Date.now();
    const info: SessionInfo = {
      id: `sess_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      title,
      createdAt: now,
      updatedAt: now,
      mode,
    };
    const data: SessionFile = { info, messages: [] };
    await writeJsonAtomic(this.filePath(info.id), data);
    this.activeId = info.id;
    this.persistActiveId();
    // Best-effort prune oldest sessions
    void this.pruneOldSessions();
    return info;
  }

  private async ensureActiveUnlocked(mode: AgentMode = "agent"): Promise<SessionInfo> {
    // A freshly launched app may still be reading the remembered id.
    await this.restorePromise;
    if (this.activeId) {
      try {
        return (await readSessionFile(this.filePath(this.activeId))).info;
      } catch {
        // fall through
      }
    }
    // No active id (fresh launch, or the active session was deleted) — start a
    // new chat. Adopting the most recently updated session would silently
    // append the first prompt to an unrelated conversation.
    return this.createUnlocked(mode);
  }

  async appendMessages(messages: ChatMessage[], mode?: AgentMode): Promise<void> {
    return this.enqueueMutation(async () => {
      const info = await this.ensureActiveUnlocked(mode);
      const path = this.filePath(info.id);
      let data: SessionFile;
      try {
        data = await readSessionFile(path);
      } catch {
        data = { info, messages: [] };
      }
      data.messages = clampMessages([...data.messages, ...compactImages(messages)]);
      data.info.updatedAt = Date.now();
      if (mode) data.info.mode = mode;
      // Auto-title from first user message
      if (data.info.title === "New chat") {
        const firstUser = data.messages.find((m) => m.role === "user");
        if (firstUser?.content) {
          data.info.title =
            firstUser.content.slice(0, 60).replace(/\s+/g, " ").trim() ||
            "New chat";
        }
      }
      await mkdir(this.dir(), { recursive: true });
      await writeJsonAtomic(path, data);
    });
  }

  async replaceMessages(id: string, messages: ChatMessage[]): Promise<void> {
    return this.enqueueMutation(async () => {
      const path = this.filePath(id);
      let data: SessionFile;
      try {
        data = await readSessionFile(path);
      } catch {
        throw new Error(`Session not found: ${id}`);
      }
      if (data.info.id !== id) throw new Error(`Session id mismatch: ${id}`);
      data.messages = clampMessages(compactImages(messages));
      data.info.updatedAt = Date.now();
      // Keep title in sync with first user message when still default
      if (!data.info.title || data.info.title === "New chat") {
        const firstUser = messages.find(
          (m) => m.role === "user" && m.content?.trim(),
        );
        if (firstUser?.content) {
          data.info.title =
            firstUser.content.slice(0, 60).replace(/\s+/g, " ").trim() ||
            "New chat";
        }
      }
      await writeJsonAtomic(path, data);
    });
  }

  async delete(id: string): Promise<void> {
    return this.enqueueMutation(async () => {
      assertSafeId(id);
      const path = this.filePath(id);
      await rm(path, { force: true });
      if (this.activeId === id) {
        this.activeId = null;
        this.persistActiveId();
      }
    });
  }

  private async pruneOldSessions(): Promise<void> {
    try {
      const list = await this.list();
      if (list.length <= MAX_SESSIONS) return;
      const drop = list.slice(MAX_SESSIONS);
      for (const s of drop) {
        try {
          await rm(this.filePath(s.id), { force: true });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
}
