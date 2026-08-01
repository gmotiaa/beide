import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";
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
import { TerminalService } from "./services/terminal";
import { WorkspaceService } from "./services/workspace";

export interface BeideServices {
  workspace: WorkspaceService;
  settings: SettingsService;
  permissions: PermissionGateway;
  checkpoints: CheckpointService;
  sessions: SessionService;
  agent: AgentService;
  terminal: TerminalService;
}

export function createServices(): BeideServices {
  const workspace = new WorkspaceService();
  const userData = app.getPath("userData");
  const settings = new SettingsService(join(userData, "settings.json"));
  const permissions = new PermissionGateway();
  const checkpoints = new CheckpointService();
  const sessions = new SessionService();
  const agent = new AgentService(settings, permissions, checkpoints, sessions);
  const terminal = new TerminalService();
  return {
    workspace,
    settings,
    permissions,
    checkpoints,
    sessions,
    agent,
    terminal,
  };
}

let registered = false;
const dirtyWindows = new WeakSet<BrowserWindow>();
const forceCloseWindows = new WeakSet<BrowserWindow>();
const guardedWindows = new WeakSet<BrowserWindow>();

function attachWindowCloseGuard(win: BrowserWindow | null): void {
  if (!win || guardedWindows.has(win)) return;
  guardedWindows.add(win);
  win.on("close", (event) => {
    if (forceCloseWindows.has(win)) {
      forceCloseWindows.delete(win);
      return;
    }
    if (win.webContents.isDestroyed()) return;
    event.preventDefault();
    if (!win.isDestroyed()) {
      win.webContents.send("window:close-requested", {
        dirty: dirtyWindows.has(win),
      });
    }
  });
}

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

  attachWindowCloseGuard(getMainWindow());

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
  rehandle("window:close", (event, discardUnsaved?: unknown) => {
    const win = windowFromEvent(event);
    if (!win) return false;
    const force =
      discardUnsaved === undefined
        ? false
        : asBoolean(discardUnsaved, "discardUnsaved");
    if (force) forceCloseWindows.add(win);
    win.close();
    return true;
  });
  rehandle("window:isMaximized", (event) => {
    return windowFromEvent(event)?.isMaximized() ?? false;
  });
  rehandle("window:setDirty", (event, dirty: unknown) => {
    const win = windowFromEvent(event);
    if (!win) return false;
    if (asBoolean(dirty, "dirty")) dirtyWindows.add(win);
    else dirtyWindows.delete(win);
    return true;
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
    services.terminal.setMainWindow(win);
  };

  if (registered) {
    bindWindow();
    return;
  }
  registered = true;

  // ── Workspace ────────────────────────────────────────────
  rehandle("workspace:pickFolder", async () => svc().workspace.pickFolder());

  rehandle("workspace:setRoot", async (_e, path: unknown) => {
    const root = await svc().workspace.setRoot(
      asString(path, "path", LIMITS.path),
    );
    try {
      await svc().agent.onWorkspaceChanged(root);
    } catch (error) {
      // The file workspace is already valid and active. Keep renderer/main in
      // sync even if optional AI initialization fails; provider errors surface
      // again through agent status when the user opens chat.
      console.error("[beide] agent failed to bind the new workspace", error);
    }
    // Remembered so the next launch reopens where the user left off.
    void svc().settings.set({ lastWorkspacePath: root });
    // Shells from the previous workspace are cwd'd into it — close them.
    svc().terminal.onWorkspaceChanged(root);
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

  rehandle("agent:installProviderKey", async (_e, ciphertext: unknown) => {
    // base64(iv || key || tag) — provider keys are short; 8 KiB is generous.
    const blob = asString(ciphertext, "ciphertext", 8192);
    return svc().agent.installEncryptedProviderKey(blob);
  });

  // ── Checkpoints ──────────────────────────────────────────
  rehandle("checkpoint:list", async () => svc().checkpoints.list());

  rehandle("checkpoint:restore", async (_e, id: unknown) => {
    const checkpointId = asString(id, "id", 128);
    const paths = await svc().checkpoints.restore(checkpointId);
    getMainWindow()?.webContents.send("workspace:changed", {
      restored: checkpointId,
      paths,
    });
    return paths;
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
  // says which conversation was open. Settled: waits for the persisted id
  // restore after a full app restart.
  rehandle("session:active", async () => svc().sessions.getActiveIdSettled());

  rehandle("session:load", async (_e, id: unknown) => {
    const sid = asString(id, "id", 128);
    const messages = await svc().sessions.load(sid);
    await svc().agent.onSessionChanged(sid, messages);
    return messages;
  });

  rehandle("session:new", async () => {
    const s = await svc().settings.get();
    const session = await svc().sessions.create(s.defaultAgentMode);
    await svc().agent.onSessionChanged(session.id, []);
    return session;
  });

  rehandle("session:save", async (_e, id: unknown, messages: unknown) => {
    const sid = asString(id, "id", 128);
    const msgs = asChatMessages(messages, "messages", LIMITS.sessionMessages);
    await svc().sessions.replaceMessages(sid, msgs);
    return { ok: true };
  });

  rehandle("session:delete", async (_e, id: unknown) => {
    const sid = asString(id, "id", 128);
    const wasActive = svc().sessions.getActiveId() === sid;
    await svc().sessions.delete(sid);
    if (wasActive) await svc().agent.onSessionChanged(null, []);
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

  // Usage limits live in Supabase (get_billing / spend_tokens RPCs, renderer
  // side) — there is no local counter backend anymore.

  // ── Terminal (PTY) ───────────────────────────────────────
  rehandle("terminal:create", async (_e, cols: unknown, rows: unknown) => {
    const root = svc().workspace.getRoot();
    if (!root) throw new IpcError("No workspace open", "NO_WORKSPACE");
    return svc().terminal.create(root, Number(cols), Number(rows));
  });

  rehandle("terminal:write", async (_e, id: unknown, data: unknown) => {
    svc().terminal.write(asString(id, "id", 64), asString(data, "data", 8192));
    return { ok: true };
  });

  rehandle("terminal:resize", async (_e, id: unknown, cols: unknown, rows: unknown) => {
    svc().terminal.resize(asString(id, "id", 64), Number(cols), Number(rows));
    return { ok: true };
  });

  rehandle("terminal:kill", async (_e, id: unknown) => {
    svc().terminal.kill(asString(id, "id", 64));
    return { ok: true };
  });

  // Bind window refs
  bindWindow();
}

export function disposeServices(services: BeideServices): void {
  if (active === services) active = null;
  void services.agent.dispose();
  services.workspace.dispose();
  services.settings.dispose();
  services.terminal.dispose();
  services.permissions.cancelAll("app shutdown");
}
