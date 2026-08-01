import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { stripSecretEnv } from "./agent";

/**
 * Hand-rolled MCP (Model Context Protocol) client — stdio transport only.
 * Servers are user-configured in `<workspace>/.beide/mcp.json`:
 *
 *   { "servers": { "<name>": { "command": "npx", "args": ["-y", "…"], "env": { "K": "V" } } } }
 *
 * Each message is one line of JSON-RPC 2.0 terminated by `\n` (per the MCP
 * stdio spec). No SDK: the protocol surface we need is initialize →
 * notifications/initialized → tools/list → tools/call.
 */

const MCP_CONFIG_REL_PATH = ".beide/mcp.json";
const MCP_PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME_RE = /^[a-z0-9_-]{1,32}$/i;
const REQUEST_TIMEOUT_MS = 15_000;

interface McpServerConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface McpToolInfo {
  server: string;
  name: string;
  description: string;
  inputSchema: unknown;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface McpConnection {
  name: string;
  child: ChildProcess;
  stdoutBuffer: string;
  nextId: number;
  pending: Map<number, PendingRequest>;
  tools: McpToolInfo[];
  dead: boolean;
}

/** `{"servers": {...}}` → validated map; anything malformed is dropped quietly. */
async function readMcpConfig(
  workspaceRoot: string,
): Promise<Record<string, McpServerConfig>> {
  let raw: string;
  try {
    raw = await readFile(join(workspaceRoot, MCP_CONFIG_REL_PATH), "utf-8");
  } catch {
    return {}; // missing file → no servers, no error
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`[mcp] ${MCP_CONFIG_REL_PATH} is not valid JSON — ignoring`);
    return {};
  }
  const servers = (parsed as { servers?: unknown })?.servers;
  if (!servers || typeof servers !== "object" || Array.isArray(servers)) return {};

  const result: Record<string, McpServerConfig> = {};
  for (const [name, value] of Object.entries(servers as Record<string, unknown>)) {
    if (!SERVER_NAME_RE.test(name)) {
      console.warn(`[mcp] invalid server name ${JSON.stringify(name)} — skipped`);
      continue;
    }
    const entry = value as { command?: unknown; args?: unknown; env?: unknown };
    if (typeof entry?.command !== "string" || !entry.command.trim()) {
      console.warn(`[mcp] server "${name}" has no command — skipped`);
      continue;
    }
    const args = Array.isArray(entry.args)
      ? entry.args.filter((a): a is string => typeof a === "string")
      : [];
    const env: Record<string, string> = {};
    if (entry.env && typeof entry.env === "object" && !Array.isArray(entry.env)) {
      for (const [k, v] of Object.entries(entry.env as Record<string, unknown>)) {
        if (typeof v === "string") env[k] = v;
      }
    }
    result[name] = { command: entry.command, args, env };
  }
  return result;
}

export class McpManager {
  private connections = new Map<string, McpConnection>();
  private workspaceRoot: string | null = null;
  private started = false;

  /**
   * Idempotent for the same workspace: mode/model changes recreate the pi
   * session but must not respawn MCP servers. A different workspace (or a
   * fresh start after stopAll) reloads the config and spawns everything anew.
   */
  async start(workspaceRoot: string): Promise<void> {
    if (this.started && this.workspaceRoot === workspaceRoot) return;
    this.stopAll();
    this.workspaceRoot = workspaceRoot;
    this.started = true;

    const config = await readMcpConfig(workspaceRoot);
    await Promise.all(
      Object.entries(config).map(([name, server]) =>
        this.startServer(name, server, workspaceRoot),
      ),
    );
  }

  getTools(): McpToolInfo[] {
    const tools: McpToolInfo[] = [];
    for (const conn of this.connections.values()) {
      if (!conn.dead) tools.push(...conn.tools);
    }
    return tools;
  }

  /**
   * `tools/call`. Text content items are concatenated; non-text items become
   * a "[non-text content]" marker. An `isError` result throws the text back
   * into the agent loop like any other failing tool.
   */
  async callTool(
    server: string,
    name: string,
    args: Record<string, unknown>,
    timeoutMs = 60_000,
  ): Promise<string> {
    const conn = this.connections.get(server);
    if (!conn || conn.dead) {
      throw new Error(`MCP server "${server}" is not running`);
    }
    const result = (await this.request(
      conn,
      "tools/call",
      { name, arguments: args },
      timeoutMs,
    )) as { content?: unknown; isError?: unknown };

    const parts: string[] = [];
    if (Array.isArray(result?.content)) {
      for (const item of result.content as Array<{ type?: unknown; text?: unknown }>) {
        if (item?.type === "text" && typeof item.text === "string") {
          parts.push(item.text);
        } else {
          parts.push("[non-text content]");
        }
      }
    }
    const text = parts.join("\n");
    if (result?.isError) {
      throw new Error(text || `MCP tool ${server}:${name} failed`);
    }
    return text || "(empty result)";
  }

  stopAll(): void {
    for (const conn of this.connections.values()) {
      this.rejectAllPending(conn, new Error("MCP server stopped"));
      conn.dead = true;
      try {
        conn.child.kill();
      } catch {
        // already gone
      }
    }
    this.connections.clear();
    this.started = false;
    this.workspaceRoot = null;
  }

  // ── internals ──────────────────────────────────────────────

  private async startServer(
    name: string,
    config: McpServerConfig,
    workspaceRoot: string,
  ): Promise<void> {
    let child: ChildProcess;
    try {
      child = spawn(config.command, config.args, {
        cwd: workspaceRoot,
        // Provider credentials in this process's env must not leak into a
        // user-configured child; explicit per-server env wins over inherited.
        env: { ...stripSecretEnv(process.env), ...config.env },
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      console.warn(`[mcp] server "${name}" failed to spawn:`, err);
      return;
    }

    const conn: McpConnection = {
      name,
      child,
      stdoutBuffer: "",
      nextId: 1,
      pending: new Map(),
      tools: [],
      dead: false,
    };
    this.connections.set(name, conn);

    child.stdout?.setEncoding("utf-8");
    child.stdout?.on("data", (chunk: string) => this.onStdout(conn, chunk));
    // stderr is the server's log channel — never parse it, never surface it.
    child.stderr?.resume();
    child.on("error", (err) => {
      conn.dead = true;
      this.rejectAllPending(conn, new Error(`MCP server "${name}": ${err.message}`));
    });
    child.on("exit", (code) => {
      conn.dead = true;
      this.rejectAllPending(conn, new Error(`MCP server "${name}" exited (code ${code})`));
    });

    try {
      await this.request(conn, "initialize", {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "beide", version: "0.1.0" },
      });
      this.notify(conn, "notifications/initialized");
      conn.tools = await this.listTools(conn);
      console.log(`[mcp] server "${name}" ready: ${conn.tools.length} tool(s)`);
    } catch (err) {
      console.warn(
        `[mcp] server "${name}" failed handshake — killed and skipped:`,
        err instanceof Error ? err.message : err,
      );
      conn.dead = true;
      this.rejectAllPending(conn, new Error("handshake failed"));
      try {
        child.kill();
      } catch {
        // ignore
      }
      this.connections.delete(name);
    }
  }

  private async listTools(conn: McpConnection): Promise<McpToolInfo[]> {
    const tools: McpToolInfo[] = [];
    let cursor: string | undefined;
    // Paginated per spec; bounded so a misbehaving server cannot loop forever.
    for (let page = 0; page < 16; page++) {
      const result = (await this.request(
        conn,
        "tools/list",
        cursor ? { cursor } : {},
      )) as {
        tools?: Array<{ name?: unknown; description?: unknown; inputSchema?: unknown }>;
        nextCursor?: unknown;
      };
      for (const tool of Array.isArray(result?.tools) ? result.tools : []) {
        if (typeof tool?.name !== "string" || !tool.name) continue;
        tools.push({
          server: conn.name,
          name: tool.name,
          description: typeof tool.description === "string" ? tool.description : "",
          inputSchema: tool.inputSchema,
        });
      }
      if (typeof result?.nextCursor === "string" && result.nextCursor) {
        cursor = result.nextCursor;
      } else {
        break;
      }
    }
    return tools;
  }

  private request(
    conn: McpConnection,
    method: string,
    params: unknown,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (conn.dead || !conn.child.stdin?.writable) {
        reject(new Error(`MCP server "${conn.name}" is not running`));
        return;
      }
      const id = conn.nextId++;
      const timer = setTimeout(() => {
        conn.pending.delete(id);
        reject(new Error(`MCP request ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      conn.pending.set(id, { resolve, reject, timer });
      this.writeMessage(conn, { jsonrpc: "2.0", id, method, params });
    });
  }

  private notify(conn: McpConnection, method: string, params?: unknown): void {
    this.writeMessage(conn, {
      jsonrpc: "2.0",
      method,
      ...(params !== undefined ? { params } : {}),
    });
  }

  private writeMessage(conn: McpConnection, message: unknown): void {
    try {
      conn.child.stdin?.write(`${JSON.stringify(message)}\n`);
    } catch (err) {
      conn.dead = true;
      this.rejectAllPending(
        conn,
        new Error(`MCP server "${conn.name}" stdin write failed: ${String(err)}`),
      );
    }
  }

  private onStdout(conn: McpConnection, chunk: string): void {
    conn.stdoutBuffer += chunk;
    let newline: number;
    while ((newline = conn.stdoutBuffer.indexOf("\n")) !== -1) {
      const line = conn.stdoutBuffer.slice(0, newline).trim();
      conn.stdoutBuffer = conn.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // not JSON-RPC (stray server output) — skip the line
      }
      this.onMessage(conn, message);
    }
  }

  private onMessage(conn: McpConnection, message: unknown): void {
    if (!message || typeof message !== "object") return;
    const msg = message as {
      id?: unknown;
      result?: unknown;
      error?: { message?: unknown; code?: unknown };
      method?: unknown;
    };
    // Server-initiated requests/notifications (logging, ping…) are ignored —
    // we only ever match responses to our own numeric ids.
    if (typeof msg.id !== "number" || !("result" in msg) === !("error" in msg)) return;
    const pending = conn.pending.get(msg.id);
    if (!pending) return;
    conn.pending.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error) {
      const text =
        typeof msg.error.message === "string"
          ? msg.error.message
          : `JSON-RPC error ${String(msg.error.code ?? "")}`;
      pending.reject(new Error(text));
    } else {
      pending.resolve(msg.result);
    }
  }

  private rejectAllPending(conn: McpConnection, err: Error): void {
    for (const pending of conn.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    conn.pending.clear();
  }
}
