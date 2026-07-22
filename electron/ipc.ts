import { BrowserWindow, ipcMain } from "electron";
import type { AgentPromptPayload, BeideSettings } from "../src/lib/types";
import type { UsagePlanId } from "../src/lib/usage";
import { AgentService, runShellCommand } from "./services/agent";
import { CheckpointService } from "./services/checkpoints";
import {
  LIMITS,
  asAgentMode,
  asArray,
  asBoolean,
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
      return await listener(event, ...args);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[beide ipc] ${channel}:`, message);
      throw e;
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

function parsePromptPayload(raw: unknown): AgentPromptPayload {
  const o = asObject(raw, "payload");
  const text = asString(o.text ?? "", "payload.text", LIMITS.promptText);
  const mode =
    o.mode === "plan" || o.mode === "agent" ? o.mode : ("agent" as const);
  const mentions = Array.isArray(o.mentions)
    ? (o.mentions as AgentPromptPayload["mentions"]).slice(0, 12)
    : [];
  const images = Array.isArray(o.images)
    ? (o.images as AgentPromptPayload["images"]).slice(0, LIMITS.images)
    : [];
  const openFiles = Array.isArray(o.openFiles)
    ? (o.openFiles as string[]).filter((p) => typeof p === "string").slice(0, 24)
    : [];
  const activeFile =
    typeof o.activeFile === "string" ? o.activeFile.slice(0, LIMITS.path) : undefined;
  return {
    text,
    mode,
    mentions,
    images,
    activeFile,
    openFiles,
  };
}

export function registerIpc(
  services: BeideServices,
  getMainWindow: () => BrowserWindow | null,
): void {
  bindWindowControls(getMainWindow);

  if (registered) {
    const win = getMainWindow();
    services.workspace.setMainWindow(win);
    services.agent.setMainWindow(win);
    services.permissions.setMainWindow(win);
    return;
  }
  registered = true;

  const { workspace, settings, agent, checkpoints, sessions, usage } = services;

  // ── Workspace ────────────────────────────────────────────
  rehandle("workspace:open", async () => {
    const root = await workspace.openFolder();
    if (root) {
      await agent.onWorkspaceChanged(root);
    }
    return root;
  });

  rehandle("workspace:getRoot", async () => workspace.getRoot());

  rehandle("workspace:readDir", async (_e, path?: unknown) => {
    const p = asOptionalString(path, "path", LIMITS.path);
    return workspace.readDir(p);
  });

  rehandle(
    "workspace:readFile",
    wrapHandler(async (_e, path: unknown) => {
      return workspace.readFile(asString(path, "path", LIMITS.path));
    }),
  );

  rehandle(
    "workspace:writeFile",
    wrapHandler(async (_e, path: unknown, content: unknown) => {
      // Editor saves are user-initiated and bypass the agent permission gate by design.
      await workspace.writeFile(
        asString(path, "path", LIMITS.path),
        asString(content, "content", LIMITS.fileContent),
      );
    }),
  );

  rehandle("workspace:search", async (_e, query: unknown) => {
    return workspace.searchFiles(asString(query, "query", LIMITS.searchQuery));
  });

  rehandle("workspace:pathExists", async (_e, path: unknown) => {
    return workspace.pathExists(asString(path, "path", LIMITS.path));
  });

  rehandle(
    "workspace:delete",
    wrapHandler(async (_e, path: unknown) => {
      await workspace.deletePath(asString(path, "path", LIMITS.path));
    }),
  );

  rehandle(
    "workspace:rename",
    wrapHandler(async (_e, path: unknown, newName: unknown) => {
      return workspace.renamePath(
        asString(path, "path", LIMITS.path),
        asString(newName, "newName", 255),
      );
    }),
  );

  rehandle("workspace:reveal", async (_e, path: unknown) => {
    await workspace.revealInFolder(asString(path, "path", LIMITS.path));
  });

  // ── Agent ────────────────────────────────────────────────
  rehandle("agent:prompt", async (_e, payload: unknown) => {
    return agent.prompt(parsePromptPayload(payload));
  });

  rehandle("agent:abort", async () => {
    await agent.abort();
  });

  rehandle("agent:setMode", async (_e, mode: unknown) => {
    await agent.setMode(asAgentMode(mode));
  });

  rehandle(
    "agent:respondPermission",
    async (_e, id: unknown, allow: unknown, content?: unknown) => {
      agent.respondPermission(
        asString(id, "id", 128),
        asBoolean(allow, "allow"),
        asOptionalString(content, "content", LIMITS.fileContent),
      );
    },
  );

  rehandle("agent:getStatus", async () => agent.getStatus());

  // ── Checkpoints ──────────────────────────────────────────
  rehandle("checkpoint:list", async () => checkpoints.list());

  rehandle("checkpoint:restore", async (_e, id: unknown) => {
    await checkpoints.restore(asString(id, "id", 128));
    getMainWindow()?.webContents.send("workspace:changed", {
      restored: asString(id, "id", 128),
    });
  });

  // ── Settings ─────────────────────────────────────────────
  rehandle("settings:get", async () => settings.get());

  rehandle("settings:set", async (_e, partial: unknown) => {
    const p = asObject(partial, "partial") as Partial<BeideSettings>;
    const next = await settings.set(p);
    if (p.permissionMode) {
      await agent.refreshPermissionMode();
    }
    return next;
  });

  // ── Sessions ─────────────────────────────────────────────
  rehandle("session:list", async () => sessions.list());

  rehandle("session:load", async (_e, id: unknown) =>
    sessions.load(asString(id, "id", 128)),
  );

  rehandle("session:new", async () => {
    const s = await settings.get();
    return sessions.create(s.defaultAgentMode);
  });

  rehandle("session:save", async (_e, id: unknown, messages: unknown) => {
    const sid = asString(id, "id", 128);
    const msgs = asArray(messages, "messages", LIMITS.sessionMessages);
    await sessions.replaceMessages(sid, msgs as never);
    return { ok: true };
  });

  rehandle("session:delete", async (_e, id: unknown) => {
    await sessions.delete(asString(id, "id", 128));
    return { ok: true };
  });

  // ── Shell ────────────────────────────────────────────────
  rehandle("shell:run", async (_e, command: unknown) => {
    return runShellCommand(
      asString(command, "command", LIMITS.shellCommand),
      workspace.getRoot(),
      30_000,
    );
  });

  // ── Usage limits ─────────────────────────────────────────
  rehandle("usage:get", async () => usage.get());
  rehandle("usage:setPlan", async (_e, plan: unknown) =>
    usage.setPlan(plan === "pro" ? "pro" : "free"),
  );
  rehandle("usage:increment", async (_e, delta: unknown) => {
    const d = (delta && typeof delta === "object" ? delta : {}) as {
      prompts?: number;
      tools?: number;
      tokens?: number;
    };
    return usage.increment({
      prompts: typeof d.prompts === "number" ? d.prompts : undefined,
      tools: typeof d.tools === "number" ? d.tools : undefined,
      tokens: typeof d.tokens === "number" ? d.tokens : undefined,
    });
  });
  rehandle("usage:resetToday", async () => usage.resetToday());

  // ── Auth (admin signup with email_confirm) ─────────────
  rehandle("auth:adminSignUp", async (_e, email: unknown, password: unknown) => {
    const { adminSignUp } = await import("./services/supabase-admin");
    return adminSignUp(
      asString(email, "email", 320),
      asString(password, "password", 256),
    );
  });

  // Bind window refs
  const win = getMainWindow();
  workspace.setMainWindow(win);
  agent.setMainWindow(win);
  services.permissions.setMainWindow(win);
}

export function disposeServices(services: BeideServices): void {
  void services.agent.dispose();
  services.workspace.dispose();
  services.settings.dispose();
  services.permissions.cancelAll("app shutdown");
}
