import type { BrowserWindow } from "electron";
import type { PermissionMode, PermissionRequest } from "../../src/lib/types";
import { simpleDiff } from "./checkpoints";

export type PermissionKind = PermissionRequest["kind"];

interface PendingPermission {
  resolve: (result: { allow: boolean; content?: string }) => void;
  reject: (err: Error) => void;
  request: PermissionRequest;
  timer: ReturnType<typeof setTimeout>;
}

const PERMISSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * PermissionGateway — ask/auto gate for write/edit/bash mutations.
 * Used by AgentService tool operation wrappers.
 */
export class PermissionGateway {
  private pending = new Map<string, PendingPermission>();
  private mainWindow: BrowserWindow | null = null;
  private mode: PermissionMode = "ask";

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  /** `webContents.send` throws once the window is destroyed. */
  private post(channel: string, payload: unknown): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch {
      // renderer torn down between the check and the send
    }
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  /**
   * Request permission for a mutation. In auto mode, resolves immediately with allow.
   * In ask mode, emits `agent:permission` and waits for `respondPermission`.
   */
  async request(input: {
    kind: PermissionKind;
    path?: string;
    command?: string;
    before?: string;
    after?: string;
    description: string;
  }): Promise<{ allow: boolean; content?: string }> {
    if (this.mode === "auto") {
      return { allow: true, content: input.after };
    }

    // Nobody can answer without a live renderer. Deny straight away instead of
    // parking the agent's tool call on a 10-minute timer.
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) {
      return { allow: false };
    }

    const id = `perm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    let diff: string | undefined;
    if (input.path && input.after !== undefined) {
      diff = simpleDiff(input.path, input.before ?? "", input.after);
    }

    const request: PermissionRequest = {
      id,
      kind: input.kind,
      path: input.path,
      command: input.command,
      diff,
      content: input.after,
      description: input.description,
    };

    return new Promise<{ allow: boolean; content?: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.post("agent:event", {
          type: "beide:permission_timeout",
          id,
          description: input.description,
        });
        resolve({ allow: false });
      }, PERMISSION_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, request, timer });
      this.post("agent:permission", request);
    });
  }

  respond(id: string, allow: boolean, content?: string): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolve({ allow, content });
  }

  /** Reject all pending (e.g. on abort / workspace change). */
  cancelAll(reason = "Permission cancelled"): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.resolve({ allow: false });
      this.pending.delete(id);
    }
    void reason;
  }

  hasPending(): boolean {
    return this.pending.size > 0;
  }
}
