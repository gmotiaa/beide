/**
 * Shell helpers shared by the agent runtime, the PTY terminal, MCP servers and
 * the git IPC handlers. Deliberately free of agent imports so loading this
 * module never drags the pi SDK into the boot path.
 */
import { spawn } from "node:child_process";

/**
 * The main process env carries provider credentials (loaded from .env). A child
 * shell the model can drive must not be able to echo them back, so anything
 * that looks like a credential is stripped before spawn.
 */
export const SECRET_ENV_KEYS = new Set([
  "BEIDE_ECHOGATE_API_KEY",
  "BEIDE_ADMIN_EMAIL",
  "BEIDE_ADMIN_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
export const SECRET_ENV_RE = /_API_KEY$|_KEY$|TOKEN|SECRET|PASSWORD|PASSWD/i;

/** Files whose contents are masked before they reach the model. */
export const SECRET_FILE_RE =
  /(^|[\\/])\.env(\.[^\\/]*)?$|\.pem$|(^|[\\/])[^\\/]*(secrets?|credentials)[^\\/]*\.(json|ya?ml|toml|env|txt)$/i;

/** `KEY=value` / `"key": "value"`-style values become ***; key names survive. */
export function maskSecretValues(text: string): string {
  return text
    .replace(/^(\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=\s*).+$/gm, "$1***")
    .replace(/("[^"]*(?:key|token|secret|password)[^"]*"\s*:\s*)"[^"]*"/gi, '$1"***"');
}

/** Shared with the PTY terminal — any user-visible shell gets the same env hygiene. */
export function stripSecretEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...source };
  for (const key of Object.keys(env)) {
    if (SECRET_ENV_KEYS.has(key) || SECRET_ENV_RE.test(key)) delete env[key];
  }
  return env;
}

export function buildChildEnv(): NodeJS.ProcessEnv {
  return stripSecretEnv({
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
  });
}

/**
 * Simple shell runner for terminal MVP (no node-pty).
 * Runs in workspace cwd with a 30s timeout.
 */
export function runShellCommand(
  command: string,
  cwd: string | null,
  timeoutMs = 30_000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    if (!cwd) {
      resolve({ code: 1, stdout: "", stderr: "No workspace open — open a folder first" });
      return;
    }

    const isWin = process.platform === "win32";
    // Force UTF-8 on Windows so Cyrillic paths/output don't garble
    const wrapped = isWin ? `chcp 65001>nul & ${command}` : command;
    const child = spawn(
      isWin ? "cmd.exe" : "/bin/sh",
      isWin ? ["/d", "/s", "/c", wrapped] : ["-c", wrapped],
      {
        cwd,
        env: buildChildEnv(),
        windowsHide: true,
        // POSIX killTree signals -pid, which only reaches the tree when the
        // child leads its own process group.
        detached: !isWin,
      },
    );

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const MAX = 1_000_000;
    let settled = false;
    let timedOut = false;

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      // The kill usually makes 'close' fire before killTree() resolves, so the
      // timeout has to be reported from the flag, not from the losing branch.
      if (timedOut) {
        stderr += `\n[beide] command timed out after ${Math.round(timeoutMs / 1000)}s`;
      }
      if (stdoutTruncated) stdout += `\n[beide] stdout truncated to last 1MB`;
      if (stderrTruncated) stderr += `\n[beide] stderr truncated to last 1MB`;
      resolve({ code: timedOut ? 124 : code, stdout, stderr });
    };

    const killTree = (): Promise<void> => {
      return new Promise((res) => {
        try {
          if (!child.pid) return res();
          if (process.platform === "win32") {
            // taskkill /T kills the whole process tree rooted at child.pid
            const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
              windowsHide: true,
            });
            killer.on("close", () => res());
            killer.on("error", () => {
              try {
                child.kill();
              } catch {
                /* ignore */
              }
              res();
            });
          } else {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              try {
                child.kill("SIGKILL");
              } catch {
                /* ignore */
              }
            }
            res();
          }
        } catch {
          res();
        }
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      void killTree().then(() => finish(124));
    }, timeoutMs);

    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
      if (stdout.length > MAX) {
        stdout = stdout.slice(-MAX);
        stdoutTruncated = true;
      }
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
      if (stderr.length > MAX) {
        stderr = stderr.slice(-MAX);
        stderrTruncated = true;
      }
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      stderr += err.message;
      finish(1);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish(code ?? 0);
    });
  });
}
