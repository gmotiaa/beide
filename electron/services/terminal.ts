import { spawn, type IPty } from "@lydell/node-pty";
import type { BrowserWindow } from "electron";
import { stripSecretEnv } from "./agent";

const MAX_TERMINALS = 8;
const MAX_WRITE_CHARS = 8192;

interface TerminalEntry {
  pty: IPty;
  workspaceRoot: string;
}

/**
 * Real PTY-backed terminals (ConPTY on Windows via @lydell/node-pty prebuilt
 * binaries). Interactive programs and ANSI TUIs work; output streams to the
 * renderer over `terminal:data` push events.
 *
 * Env hygiene matters here just like in the agent's bash tool: the shell must
 * not inherit provider credentials, so everything secret-shaped is stripped
 * before spawn (stripSecretEnv).
 */
export class TerminalService {
  private terminals = new Map<string, TerminalEntry>();
  private mainWindow: BrowserWindow | null = null;
  private counter = 0;

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  private send(channel: string, payload: unknown): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send(channel, payload);
    } catch {
      // renderer torn down between the check and the send
    }
  }

  create(workspaceRoot: string, cols: number, rows: number): { id: string } {
    if (this.terminals.size >= MAX_TERMINALS) {
      throw new Error(`Too many terminals (max ${MAX_TERMINALS})`);
    }
    const id = `term_${Date.now().toString(36)}_${++this.counter}`;
    const isWin = process.platform === "win32";
    const shell = isWin
      ? process.env.COMSPEC || "cmd.exe"
      : process.env.SHELL || "/bin/sh";
    const pty = spawn(shell, [], {
      name: "xterm-256color",
      cols: clampDim(cols, 80),
      rows: clampDim(rows, 24),
      cwd: workspaceRoot,
      env: stripSecretEnv({
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      }) as Record<string, string>,
    });

    pty.onData((data) => this.send("terminal:data", { id, data }));
    pty.onExit(({ exitCode }) => {
      this.terminals.delete(id);
      this.send("terminal:exit", { id, exitCode });
    });

    this.terminals.set(id, { pty, workspaceRoot });
    return { id };
  }

  write(id: string, data: string): void {
    const entry = this.terminals.get(id);
    if (!entry) return;
    entry.pty.write(data.slice(0, MAX_WRITE_CHARS));
  }

  resize(id: string, cols: number, rows: number): void {
    const entry = this.terminals.get(id);
    if (!entry) return;
    try {
      entry.pty.resize(clampDim(cols, 80), clampDim(rows, 24));
    } catch {
      // resize on a just-exited pty throws — the exit event is on its way
    }
  }

  kill(id: string): void {
    const entry = this.terminals.get(id);
    if (!entry) return;
    this.terminals.delete(id);
    try {
      entry.pty.kill();
    } catch {
      // already gone
    }
  }

  /** Shells belong to the workspace they were opened in. */
  onWorkspaceChanged(root: string | null): void {
    for (const [id, entry] of this.terminals) {
      if (entry.workspaceRoot !== root) this.kill(id);
    }
  }

  dispose(): void {
    for (const id of [...this.terminals.keys()]) this.kill(id);
  }
}

function clampDim(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(500, Math.max(2, Math.round(value)));
}
