import { BrowserWindow, ipcMain } from "electron";
import type {
  AgentPromptPayload,
  BeideSettings,
  ChatImage,
  ChatMention,
} from "../src/lib/types";
import { findModel } from "../src/lib/models";
import { AgentService, runShellCommand } from "./services/agent";
import { CheckpointService } from "./services/checkpoints";
import {
  IpcError,
  LIMITS,
  asAgentMode,
  asBoolean,
  asChatMessages,
  asObject,
  asOptionalString,
  asString,
  wrapHandler,
} from "./services/ipc-utils";
import { PermissionGateway } from "./services/permissions";
import { SessionService } from "./services/sessions";
import { SettingsService } from "./services/settings";
import { UsageService } from "./services/usage";
import { WorkspaceService } from "./services/workspace";

export interface BeideServices {
  workspace: WorkspaceService;
  settings: SettingsService;
  permissions: PermissionGateway;
  checkpoints: CheckpointService;
  sessions: SessionService;
  agent: AgentService;
  usage: UsageService;
}

export function createServices(): BeideServices {
  const workspace = new WorkspaceService();
  const settings = new SettingsService();
  const permissions = new PermissionGateway();
  const checkpoints = new CheckpointService();
  const sessions = new SessionService();
  const usage = new UsageService();
  const agent = new AgentService(
    settings,
    permissions,
    checkpoints,
    sessions,
    usage,
  );
  return {
    workspace,
    settings,
    permissions,
    checkpoints,
    sessions,
    agent,
    usage,
  };
}

let registered = false;

/**
 * Handlers are registered once but the services behind them can be rebuilt
 * (macOS `activate` re-runs bootstrap). They therefore resolve the *current*
 * services through this ref instead of closing over the first instance —
 * otherwise every channel would keep talking to a disposed object graph.
 */
let active: BeideServices | null = null;

function svc(): BeideServices {
  if (!active) {
    throw new IpcError("Services are not initialised yet", "NOT_READY");
  }
  return active;
}

/** Replace handle safely (Electron throws if channel already has a handler). */
function rehandle(
  channel: string,
  listener: (
    event: Electron.IpcMainInvokeEvent,
    ...args: unknown[]
  ) => unknown,
): void {
  try {
    ipcMain.removeHandler(channel);
  } catch {
    /* none */
  }
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const data = await listener(event, ...args);
      return { success: true, data };
    } catch (e) {
      const code = e instanceof IpcError ? e.code : "INTERNAL_ERROR";
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[beide ipc] ${channel} [${code}]:`, message);
      return { success: false, error: { message, code } };
    }
  });
}

function bindWindowControls(getMainWindow: () => BrowserWindow | null): void {
  const windowFromEvent = (event: Electron.IpcMainInvokeEvent) =>
    BrowserWindow.fromWebContents(event.sender) ?? getMainWindow();

  rehandle("window:minimize", (event) => {
    windowFromEvent(event)?.minimize();
    return true;
  });
  rehandle("window:maximize", (event) => {
    const w = windowFromEvent(event);
    if (!w) return false;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
    return w.isMaximized();
  });
  rehandle("window:close", (event) => {
    windowFromEvent(event)?.close();
    return true;
  });
  rehandle("window:isMaximized", (event) => {
    return windowFromEvent(event)?.isMaximized() ?? false;
  });
}

// The picker accepts image/*, so anything narrower than what the providers take
// would drop a legitimate attachment silently (heic/heif from phone photos).
const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp|avif|heic|heif)$/;
const MAX_MENTIONS = 12;

/** Renderer input is untrusted: drop entries that are not well-formed rather than trusting the cast. */
function parseImages(raw: unknown): ChatImage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatImage[] = [];
  for (const item of raw) {
    if (out.length >= LIMITS.images) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.mimeType !== "string" || !IMAGE_MIME_RE.test(o.mimeType)) continue;
    if (typeof o.data !== "string" || o.data.length > LIMITS.imageDataChars) continue;
    const img: ChatImage = { mimeType: o.mimeType, data: o.data };
    if (typeof o.name === "string") img.name = o.name.slice(0, 255);
    out.push(img);
  }
  return out;
}

function parseMentions(raw: unknown): ChatMention[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMention[] = [];
  for (const item of raw) {
    if (out.length >= MAX_MENTIONS) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "file" && o.type !== "folder") continue;
    if (typeof o.path !== "string" || o.path.length > LIMITS.path) continue;
    if (typeof o.name !== "string") continue;
    out.push({ type: o.type, path: o.path, name: o.name.slice(0, 255) });
  }
  return out;
}

function parsePromptPayload(raw: unknown): AgentPromptPayload {
  const o = asObject(raw, "payload");
  const text = asString(o.text ?? "", "payload.text", LIMITS.promptText);
  // No default: an absent/garbled mode must not silently escalate a plan-mode
  // service into agent mode — promptImpl keeps the current mode instead.
  const mode = o.mode === "plan" || o.mode === "agent" ? o.mode : undefined;
  const mentions = parseMentions(o.mentions);
  const images = parseImages(o.images);
  const openFiles = Array.isArray(o.openFiles)
    ? (o.openFiles as unknown[])
        .filter((p): p is string => typeof p === "string" && p.length <= LIMITS.path)
        .slice(0, 24)
    : [];
  const activeFile =
    typeof o.activeFile === "string" ? o.activeFile.slice(0, LIMITS.path) : undefined;
  const activeFileContent =
    typeof o.activeFileContent === "string"
      ? o.activeFileContent.slice(0, 200_000)
      : undefined;
  return {
    text,
    mode,
    mentions,
    images,
    activeFile,
    activeFileContent,
    openFiles,
  };
}

export function registerIpc(
  services: BeideServices,
  getMainWindow: () => BrowserWindow | null,
): void {
  bindWindowControls(getMainWindow);

  active = services;

  const bindWindow = () => {
    const win = getMainWindow();
    services.workspace.setMainWindow(win);
    services.agent.setMainWindow(win);
    services.permissions.setMainWindow(win);
  };

  if (registered) {
    bindWindow();
    return;
  }
  registered = true;

  // ── Workspace ────────────────────────────────────────────
  rehandle("workspace:open", async () => {
    const root = await svc().workspace.openFolder();
    if (root) {
      await svc().agent.onWorkspaceChanged(root);
    }
    return root;
  });

  rehandle("workspace:getRoot", async () => svc().workspace.getRoot());

  rehandle("workspace:readDir", async (_e, path?: unknown) => {
    const p = asOptionalString(path, "path", LIMITS.path);
    return svc().workspace.readDir(p);
  });

  rehandle(
    "workspace:readFile",
    wrapHandler(async (_e, path: unknown) => {
      return svc().workspace.readFile(asString(path, "path", LIMITS.path));
    }),
  );

  rehandle(
    "workspace:writeFile",
    wrapHandler(async (_e, path: unknown, content: unknown) => {
      // Editor saves are user-initiated and bypass the agent permission gate by design.
      await svc().workspace.writeFile(
        asString(path, "path", LIMITS.path),
        asString(content, "content", LIMITS.fileContent),
      );
    }),
  );

  rehandle("workspace:search", async (_e, query: unknown) => {
    return svc().workspace.searchFiles(asString(query, "query", LIMITS.searchQuery));
  });

  rehandle("workspace:pathExists", async (_e, path: unknown) => {
    return svc().workspace.pathExists(asString(path, "path", LIMITS.path));
  });

  rehandle(
    "workspace:delete",
    wrapHandler(async (_e, path: unknown) => {
      await svc().workspace.deletePath(asString(path, "path", LIMITS.path));
    }),
  );

  rehandle(
    "workspace:rename",
    wrapHandler(async (_e, path: unknown, newName: unknown) => {
      return svc().workspace.renamePath(
        asString(path, "path", LIMITS.path),
        asString(newName, "newName", 255),
      );
    }),
  );

  rehandle("workspace:reveal", async (_e, path: unknown) => {
    await svc().workspace.revealInFolder(asString(path, "path", LIMITS.path));
  });

  // ── Agent ────────────────────────────────────────────────
  rehandle("agent:prompt", async (_e, payload: unknown) => {
    return svc().agent.prompt(parsePromptPayload(payload));
  });

  rehandle("agent:abort", async () => {
    await svc().agent.abort();
  });

  rehandle("agent:setMode", async (_e, mode: unknown) => {
    await svc().agent.setMode(asAgentMode(mode));
  });

  rehandle("agent:setModel", async (_e, model: unknown) => {
    const id = asString(model, "model", 128);
    // docs/IPC.md: the id must exist in src/lib/models.ts. Without this check
    // an arbitrary string rode along to createSession and only surfaced as a
    // confusing fallback warning at the next prompt.
    if (!findModel(id)) {
      throw new IpcError(`Unknown model id: ${id}`, "INVALID_MODEL");
    }
    await svc().agent.setModel(id);
  });

  rehandle(
    "agent:respondPermission",
    async (_e, id: unknown, allow: unknown, content?: unknown) => {
      svc().agent.respondPermission(
        asString(id, "id", 128),
        asBoolean(allow, "allow"),
        asOptionalString(content, "content", LIMITS.fileContent),
      );
    },
  );

  rehandle("agent:getStatus", async () => svc().agent.getStatus());

  rehandle("agent:getProviders", async () => svc().agent.getProviders());

  // ── Checkpoints ──────────────────────────────────────────
  rehandle("checkpoint:list", async () => svc().checkpoints.list());

  rehandle("checkpoint:restore", async (_e, id: unknown) => {
    await svc().checkpoints.restore(asString(id, "id", 128));
    getMainWindow()?.webContents.send("workspace:changed", {
      restored: asString(id, "id", 128),
    });
  });

  // ── Settings ─────────────────────────────────────────────
  rehandle("settings:get", async () => svc().settings.get());

  rehandle("settings:set", async (_e, partial: unknown) => {
    const p = asObject(partial, "partial") as Partial<BeideSettings>;
    const next = await svc().settings.set(p);
    if (p.permissionMode) {
      await svc().agent.refreshPermissionMode();
    }
    return next;
  });

  // ── Sessions ─────────────────────────────────────────────
  rehandle("session:list", async () => svc().sessions.list());

  // The session main is currently appending to. The renderer holds the
  // transcript in memory only, so after a reload this is the one thing that
  // says which conversation was open.
  rehandle("session:active", async () => svc().sessions.getActiveId());

  rehandle("session:load", async (_e, id: unknown) =>
    svc().sessions.load(asString(id, "id", 128)),
  );

  rehandle("session:new", async () => {
    const s = await svc().settings.get();
    return svc().sessions.create(s.defaultAgentMode);
  });

  rehandle("session:save", async (_e, id: unknown, messages: unknown) => {
    const sid = asString(id, "id", 128);
    const msgs = asChatMessages(messages, "messages", LIMITS.sessionMessages);
    await svc().sessions.replaceMessages(sid, msgs);
    return { ok: true };
  });

  rehandle("session:delete", async (_e, id: unknown) => {
    await svc().sessions.delete(asString(id, "id", 128));
    return { ok: true };
  });

  // ── Shell ────────────────────────────────────────────────
  rehandle("shell:run", async (_e, command: unknown) => {
    const cmd = asString(command, "command", LIMITS.shellCommand);
    if (svc().permissions.getMode() !== "auto") {
      const decision = await svc().permissions.request({
        kind: "bash",
        command: cmd,
        description: `Run terminal command: ${cmd}`,
      });
      if (!decision.allow) {
        return { code: 1, stdout: "", stderr: "Command denied by user." };
      }
    }
    return runShellCommand(cmd, svc().workspace.getRoot(), 30_000);
  });

  // ── Usage limits ─────────────────────────────────────────
  rehandle("usage:get", async () => svc().usage.get());
  rehandle("usage:increment", async (_e, delta: unknown) => {
    const d = (delta && typeof delta === "object" ? delta : {}) as {
      prompts?: number;
      tools?: number;
      tokens?: number;
    };
    // NaN/Infinity would poison the persisted counters and zero out the quota.
    const count = (v: unknown): number | undefined =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
    return svc().usage.increment({
      prompts: count(d.prompts),
      tools: count(d.tools),
      tokens: count(d.tokens),
    });
  });

  // Bind window refs
  bindWindow();
}

export function disposeServices(services: BeideServices): void {
  if (active === services) active = null;
  void services.agent.dispose();
  services.workspace.dispose();
  services.settings.dispose();
  services.permissions.cancelAll("app shutdown");
}
