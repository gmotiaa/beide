import { spawn, type IPty } from "@lydell/node-pty";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { BrowserWindow } from "electron";
import { stripSecretEnv } from "./shell";

const MAX_TERMINALS = 8;
const MAX_WRITE_CHARS = 8192;

export interface ShellInfo {
  id: string;
  label: string;
  path: string;
}

interface TerminalEntry {
  pty: IPty;
  workspaceRoot: string;
}

/** Resolve an executable through PATH (`where` / `which`); null when absent. */
function resolveOnPath(exe: string): string | null {
  try {
    const finder = process.platform === "win32" ? "where.exe" : "which";
    const out = execFileSync(finder, [exe], {
      encoding: "utf-8",
      windowsHide: true,
      timeout: 5_000,
    });
    const first = out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    return first && existsSync(first) ? first : null;
  } catch {
    return null;
  }
}

/**
 * Installed shells are detected once per app run (spawning `where` and
 * stat'ing install paths on every terminal:create would be wasted work —
 * shells do not come and go while the IDE runs).
 */
let shellCache: ShellInfo[] | null = null;

function detectShells(): ShellInfo[] {
  const shells: ShellInfo[] = [];
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot || "C:\\Windows";
    // cmd is always first: create() without a shellId keeps the historical
    // COMSPEC behavior.
    shells.push({
      id: "cmd",
      label: "Command Prompt",
      path: process.env.COMSPEC || join(systemRoot, "System32", "cmd.exe"),
    });
    const powershell = join(
      systemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    if (existsSync(powershell)) {
      shells.push({ id: "powershell", label: "Windows PowerShell", path: powershell });
    }
    const pwsh =
      [
        "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
        "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
        "C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe",
      ].find((p) => existsSync(p)) ?? resolveOnPath("pwsh");
    if (pwsh) {
      shells.push({ id: "pwsh", label: "PowerShell 7", path: pwsh });
    }
    const gitBash = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ].find((p) => existsSync(p));
    if (gitBash) {
      shells.push({ id: "git-bash", label: "Git Bash", path: gitBash });
    }
  } else {
    const seen = new Set<string>();
    const push = (id: string, label: string, path: string | undefined) => {
      if (!path || seen.has(path) || !existsSync(path)) return;
      seen.add(path);
      shells.push({ id, label, path });
    };
    const userShell = process.env.SHELL;
    if (userShell) push("default", basename(userShell), userShell);
    push("bash", "bash", "/bin/bash");
    push("sh", "sh", "/bin/sh");
    // Old fallback for machines with no $SHELL and nothing detectable.
    if (shells.length === 0) {
      shells.push({ id: "sh", label: "sh", path: "/bin/sh" });
    }
  }
  return shells;
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

  /** Detected shells the picker may offer; cached for the app's lifetime. */
  listShells(): ShellInfo[] {
    if (!shellCache) shellCache = detectShells();
    return shellCache;
  }

  create(
    workspaceRoot: string,
    cols: number,
    rows: number,
    shellId?: string,
  ): { id: string } {
    if (this.terminals.size >= MAX_TERMINALS) {
      throw new Error(`Too many terminals (max ${MAX_TERMINALS})`);
    }
    const id = `term_${Date.now().toString(36)}_${++this.counter}`;
    // Allowlist: the renderer sends an id, never a path — an unknown id
    // (stale localStorage, uninstalled shell) falls back to the default
    // entry instead of ever spawning an arbitrary string.
    const shells = this.listShells();
    const shell = (shells.find((s) => s.id === shellId) ?? shells[0]!).path;
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
