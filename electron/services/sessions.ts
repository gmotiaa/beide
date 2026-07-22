import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentMode, ChatMessage, SessionInfo } from "../../src/lib/types";
import { getSessionsDir } from "./paths";

interface SessionFile {
  info: SessionInfo;
  messages: ChatMessage[];
}

const ID_RE = /^[a-z0-9_-]+$/i;
const MAX_MESSAGES = 2_000;
const MAX_SESSIONS = 80;

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

export class SessionService {
  private workspaceRoot: string | null = null;
  private activeId: string | null = null;

  setWorkspace(root: string | null): void {
    this.workspaceRoot = root;
    this.activeId = null;
  }

  getActiveId(): string | null {
    return this.activeId;
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
        const raw = await readFile(join(this.dir(), name), "utf-8");
        const data = JSON.parse(raw) as SessionFile;
        if (data.info) out.push(data.info);
      } catch {
        // skip
      }
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    return out;
  }

  async load(id: string): Promise<ChatMessage[]> {
    const raw = await readFile(this.filePath(id), "utf-8");
    const data = JSON.parse(raw) as SessionFile;
    this.activeId = id;
    return data.messages ?? [];
  }

  async create(mode: AgentMode = "agent", title = "New chat"): Promise<SessionInfo> {
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
    // Best-effort prune oldest sessions
    void this.pruneOldSessions();
    return info;
  }

  async ensureActive(mode: AgentMode = "agent"): Promise<SessionInfo> {
    if (this.activeId) {
      try {
        const raw = await readFile(this.filePath(this.activeId), "utf-8");
        return (JSON.parse(raw) as SessionFile).info;
      } catch {
        // fall through
      }
    }
    const list = await this.list();
    if (list[0]) {
      this.activeId = list[0].id;
      return list[0];
    }
    return this.create(mode);
  }

  async appendMessages(messages: ChatMessage[], mode?: AgentMode): Promise<void> {
    const info = await this.ensureActive(mode);
    const path = this.filePath(info.id);
    let data: SessionFile;
    try {
      data = JSON.parse(await readFile(path, "utf-8")) as SessionFile;
    } catch {
      data = { info, messages: [] };
    }
    data.messages = clampMessages([...data.messages, ...messages]);
    data.info.updatedAt = Date.now();
    if (mode) data.info.mode = mode;
    // Auto-title from first user message
    if (data.info.title === "New chat") {
      const firstUser = data.messages.find((m) => m.role === "user");
      if (firstUser?.content) {
        data.info.title =
          firstUser.content.slice(0, 60).replace(/\s+/g, " ").trim() || "New chat";
      }
    }
    await mkdir(this.dir(), { recursive: true });
    await writeJsonAtomic(path, data);
  }

  async replaceMessages(id: string, messages: ChatMessage[]): Promise<void> {
    const path = this.filePath(id);
    let data: SessionFile;
    try {
      data = JSON.parse(await readFile(path, "utf-8")) as SessionFile;
    } catch {
      throw new Error(`Session not found: ${id}`);
    }
    data.messages = clampMessages(messages);
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
  }

  async delete(id: string): Promise<void> {
    assertSafeId(id);
    const path = this.filePath(id);
    await rm(path, { force: true });
    if (this.activeId === id) this.activeId = null;
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
