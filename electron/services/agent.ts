import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { BrowserWindow } from "electron";
import { Type } from "typebox";
import {
  createAgentSession,
  createBashToolDefinition,
  createEditToolDefinition,
  createLocalBashOperations,
  createReadToolDefinition,
  createWriteToolDefinition,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
} from "@earendil-works/pi-coding-agent";
import type {
  AgentMode,
  AgentPromptPayload,
  ChatMessage,
  ChatMention,
} from "../../src/lib/types";
import type { CheckpointService } from "./checkpoints";
import type { PermissionGateway } from "./permissions";
import {
  getPiAgentDir,
  getRulesCandidates,
  resolveInWorkspace,
  toWorkspaceRelative,
} from "./paths";
import type { SessionService } from "./sessions";
import type { SettingsService } from "./settings";
import type { UsageService } from "./usage";

const PREFERRED_PROVIDER = "xai";
const PREFERRED_MODEL = "grok-4.5";

function buildSystemPrompt(mode: AgentMode): string {
  const base = [
    "Ты — beide-агент: AI-помощник внутри desktop IDE (Electron, Windows). Отвечай по-русски, кратко и по делу.",
    "Пользователь уже в IDE: есть workspace, file tree, редактор и терминал. Не проси «пришли код» — читай сам через tools.",
    "Стримь текст сразу. Не жди конца всех tool calls, чтобы ответить.",
    "Пути относительно корня workspace, только `/` (не Windows `\\`).",
    "",
    "## Инструменты",
    "- read — прочитать файл (abs или relative path).",
    "- ls — список каталога (сначала корень / src, если не знаешь структуру).",
    "- find — glob по именам: `**/*.ts`, `src/**/*.{tsx,ts}`, `**/package.json`. Не regex.",
    "- grep — поиск по содержимому (pattern + опц. path).",
    "- bash — shell в cwd workspace. Plan-режим: только readonly (ls/dir/type/git status/log/diff, grep, npm ls…).",
    "- todo — чеклист (pending | in_progress | completed). Передавай полный массив todos каждый раз.",
    "- plan — title + summary (нумерованные шаги).",
    "- edit / write — только agent-режим; перед edit всегда read.",
    "- workspace_map — быстрая карта проекта (топ-уровневые папки + ключевые файлы). Предпочтительнее серии ls.",
    "- project_info — package.json (scripts, deps) одним вызовом.",
    "- git_status — git status/branch/diff --stat (readonly).",
    "",
    "## Как работать в IDE",
    "1. Смотри Editor context (Active file / Open tabs) и Workspace file tree snapshot — это уже в system prompt.",
    "2. Если вопрос про «этот файл» / открытый код — начни с Active file (уже может быть вложен snippet).",
    "3. Карта: `workspace_map` или `project_info` → точечный `grep`/`read`. Не делай 10 ls подряд.",
    "4. Не делай 10+ read подряд: сначала сужай поиск find/grep, потом 1–3 точных read.",
    "5. Если tool вернул 0 результатов — расширь glob или смени query; не сдавайся после одной попытки.",
    "6. Windows: для bash предпочитай простые команды (dir, type, git, npm). Не полагайся на bash-only утилиты без проверки.",
    "7. Перед коммитом/PR — `git_status`, не выдумывай diff.",
    "",
    "## Качество кода",
    "- Минимум диффа: только то, что нужно задаче.",
    "- Не добавляй try/catch, валидацию, абстракции «на будущее».",
    "- Не пиши комментарии, если «почему» ясно из кода.",
    "- Сохраняй стиль файла (кавычки, отступы, импорты).",
    "- Не создавай файл, если можно дополнить существующий.",
    "- После правок — 1–2 предложения: что сделано и где.",
    "",
    "## Чекпоинты и разрешения",
    "Перед write/edit beide снимает snapshot; в ask-режиме UI спросит подтверждение.",
    "Если write/edit/bash отклонён — не зацикливайся: предложи альтернативу или спроси пользователя.",
  ];
  if (mode === "plan") {
    base.push(
      "",
      "## РЕЖИМ: PLAN",
      "Запрещено: create/edit/delete файлов и мутирующий bash (install, commit, push, rm…).",
      "Можно: read, ls, find, grep, readonly bash, todo, plan.",
      "В конце обязательно вызови tool `plan`: title + summary с шагами (файл → что сделать).",
      "План должен быть исполнимым в agent-режиме без дополнительных уточнений, если контекста хватает.",
    );
  } else {
    base.push(
      "",
      "## РЕЖИМ: AGENT",
      "Можно: read/write/edit/bash + todo/plan.",
      "Задачи на 3+ шага — веди `todo`, обновляй статусы по ходу (один in_progress).",
      "Не останавливайся на «вот что нужно сделать» — делай правки сам, если это явно задача на реализацию.",
    );
  }
  return base.join("\n");
}

async function loadProjectRules(cwd: string): Promise<string> {
  const chunks: string[] = [];
  for (const p of getRulesCandidates(cwd)) {
    try {
      const text = await readFile(p, "utf-8");
      if (text.trim()) {
        chunks.push(`# Project rules (${p})\n${text.trim()}`);
      }
    } catch {
      // missing ok
    }
  }
  return chunks.join("\n\n");
}

/** Fast map for workspace_map tool (1–2 levels, skips heavy dirs). */
async function buildQuickWorkspaceMap(
  cwd: string,
  relRoot: string,
  depth: number,
): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  const skip = new Set([
    "node_modules",
    ".git",
    "dist",
    "out",
    ".next",
    "coverage",
    "__pycache__",
    ".beide",
    "tmp-ae",
    ".turbo",
    ".cache",
    "build",
  ]);
  const important = new Set([
    "src",
    "app",
    "apps",
    "packages",
    "electron",
    "lib",
    "components",
    "public",
    "scripts",
    "supabase",
    "tests",
    "test",
    "docs",
  ]);
  const lines: string[] = [];
  const base = relRoot ? join(cwd, relRoot) : cwd;

  const walk = async (dir: string, prefix: string, level: number) => {
    if (lines.length >= 200 || level > depth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (lines.length >= 200) break;
      if (skip.has(entry.name)) continue;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        lines.push(`${rel}/`);
        // Deeper only for important dirs or depth==2 top-level
        if (level < depth && (level === 0 || important.has(entry.name))) {
          await walk(join(dir, entry.name), rel, level + 1);
        }
      } else {
        lines.push(rel);
      }
    }
  };

  await walk(base, relRoot.replace(/\\/g, "/").replace(/\/$/, ""), 0);
  return lines;
}

/** Shallow file tree for system context so the agent knows the project layout. */
async function buildWorkspaceTreeSnapshot(cwd: string, maxEntries = 250): Promise<string> {
  const { readdir } = await import("node:fs/promises");
  const skip = new Set([
    "node_modules",
    ".git",
    "dist",
    "out",
    ".next",
    "coverage",
    "__pycache__",
    ".beide",
    "tmp-ae",
    ".turbo",
    ".cache",
    "build",
  ]);
  const lines: string[] = [];

  const walk = async (dir: string, prefix: string, depth: number): Promise<void> => {
    if (lines.length >= maxEntries || depth > 4) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entry of entries) {
      if (lines.length >= maxEntries) break;
      if (entry.name.startsWith(".") && entry.name !== ".env.example") {
        if (skip.has(entry.name) || entry.name === ".git") continue;
      }
      if (skip.has(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        lines.push(`${rel}/`);
        await walk(join(dir, entry.name), rel, depth + 1);
      } else {
        lines.push(rel);
      }
    }
  };

  await walk(cwd, "", 0);
  if (!lines.length) return "";
  const body = lines.slice(0, maxEntries).join("\n");
  const more = lines.length >= maxEntries ? "\n… (truncated — use ls/find for more)" : "";
  return `## Workspace file tree (snapshot)\n\
\
${body}${more}`;
}

function mentionsPreamble(mentions: ChatMention[]): string {
  if (!mentions.length) return "";
  const lines = mentions.map((m) => `- @${m.type}:${m.path} (${m.name})`);
  return [
    "## User @mentions (extra context — read these if relevant)",
    ...lines,
    "",
  ].join("\n");
}

function openFilesPreamble(activeFile?: string, openFiles?: string[]): string {
  const lines: string[] = [];
  if (activeFile) lines.push(`Active file: ${activeFile}`);
  if (openFiles?.length) {
    const tabs = openFiles.filter((p) => p !== activeFile).slice(0, 12);
    if (tabs.length) lines.push(`Open tabs: ${tabs.join(", ")}`);
  }
  if (!lines.length) return "";
  return `## Editor context\n${lines.join("\n")}\n\n`;
}

/** Best-effort inject of active editor buffer so agent doesn't re-read blindly. */
async function activeFileSnippet(
  cwd: string,
  activeFile?: string,
  maxChars = 24_000,
): Promise<string> {
  if (!activeFile) return "";
  try {
    const abs = resolveInWorkspace(cwd, activeFile);
    const text = await readFile(abs, "utf-8");
    if (!text.trim()) return "";
    const clipped =
      text.length > maxChars
        ? `${text.slice(0, maxChars)}\n…[truncated ${text.length - maxChars} chars — use read for full file]`
        : text;
    return `## Active file contents (\`${activeFile}\`)\n\`\`\`\n${clipped}\n\`\`\`\n\n`;
  } catch {
    return `## Active file\n\`${activeFile}\` (unreadable from disk — may be unsaved)\n\n`;
  }
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class AgentService {
  private session: AgentSession | null = null;
  private unsubscribe: (() => void) | null = null;
  private mainWindow: BrowserWindow | null = null;
  private workspaceRoot: string | null = null;
  private mode: AgentMode = "agent";
  private streaming = false;
  private modelLabel: string | undefined;
  private modelRuntime: ModelRuntime | null = null;
  private initPromise: Promise<void> | null = null;
  /** Serialize prompts — prevent concurrent session.prompt races */
  private promptChain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly settings: SettingsService,
    private readonly permissions: PermissionGateway,
    private readonly checkpoints: CheckpointService,
    private readonly sessions: SessionService,
    private readonly usage?: UsageService,
  ) {}

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
    this.permissions.setMainWindow(win);
  }

  async onWorkspaceChanged(root: string | null): Promise<void> {
    await this.teardownSession();
    this.workspaceRoot = root;
    this.checkpoints.setWorkspace(root);
    this.sessions.setWorkspace(root);
    if (root) {
      const s = await this.settings.get();
      this.mode = s.defaultAgentMode;
      this.permissions.setMode(s.permissionMode);
      // Lazy init on first prompt; pre-warm model runtime
      void this.ensureRuntime();
    }
  }

  async refreshPermissionMode(): Promise<void> {
    const s = await this.settings.get();
    this.permissions.setMode(s.permissionMode);
  }

  getStatus(): {
    ready: boolean;
    streaming: boolean;
    mode: AgentMode;
    model?: string;
  } {
    return {
      ready: Boolean(this.workspaceRoot),
      streaming: this.streaming,
      mode: this.mode,
      model: this.modelLabel,
    };
  }

  async setMode(mode: AgentMode): Promise<void> {
    if (this.mode === mode && this.session) return;
    this.mode = mode;
    // Rebuild session so tool allowlist + system prompt match mode
    if (this.workspaceRoot) {
      await this.teardownSession();
      // Session recreated lazily on next prompt
    }
  }

  async prompt(payload: AgentPromptPayload): Promise<{ ok: boolean; error?: string }> {
    // Queue concurrent prompts so we never double-enter session.prompt
    const run = () => this.promptImpl(payload);
    const next = this.promptChain.then(run, run);
    this.promptChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async promptImpl(
    payload: AgentPromptPayload,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.workspaceRoot) {
      return { ok: false, error: "No workspace open" };
    }

    const userText =
      typeof payload.text === "string" ? payload.text : String(payload.text ?? "");
    if (userText.length > 200_000) {
      return { ok: false, error: "Prompt too large (max 200k characters)" };
    }

    // Usage is charged in the renderer (Supabase when signed in, else local).
    // Main only enforces workspace + session safety.

    try {
      if (payload.mode && payload.mode !== this.mode) {
        await this.setMode(payload.mode);
      }

      await this.ensureSession();
      if (!this.session) {
        return { ok: false, error: "Agent session failed to start" };
      }

      const s = await this.settings.get();
      this.permissions.setMode(s.permissionMode);

      const activeSnippet = await activeFileSnippet(
        this.workspaceRoot,
        payload.activeFile,
      );
      const preamble = [
        openFilesPreamble(payload.activeFile, payload.openFiles),
        activeSnippet,
        mentionsPreamble(payload.mentions ?? []),
      ]
        .filter(Boolean)
        .join("");

      // Inject mention file contents (best-effort, capped)
      let mentionBodies = "";
      const mentions = (payload.mentions ?? []).slice(0, 12);
      for (const m of mentions) {
        if (m.type !== "file") continue;
        if (
          m.path === payload.activeFile &&
          activeSnippet.includes("Active file contents")
        ) {
          continue;
        }
        try {
          const abs = resolveInWorkspace(this.workspaceRoot, m.path);
          const text = await readFile(abs, "utf-8");
          const clipped =
            text.length > 80_000 ? `${text.slice(0, 80_000)}\n…[truncated]` : text;
          mentionBodies += `\n### File: ${m.path}\n\`\`\`\n${clipped}\n\`\`\`\n`;
        } catch {
          mentionBodies += `\n### File: ${m.path}\n(unreadable)\n`;
        }
      }

      const text = `${preamble}${mentionBodies}${userText}`.trim();

      const images = (payload.images ?? []).slice(0, 8).map((img) => ({
        type: "image" as const,
        data: img.data,
        mimeType: img.mimeType,
      }));

      // Persist user message
      const userMsg: ChatMessage = {
        id: uid("msg"),
        role: "user",
        content: userText,
        images: payload.images?.slice(0, 8),
        mentions: payload.mentions?.slice(0, 12),
        createdAt: Date.now(),
      };
      await this.sessions.appendMessages([userMsg], this.mode);

      this.streaming = true;
      this.emit({ type: "beide:status", streaming: true, mode: this.mode });

      try {
        if (this.session.isStreaming) {
          await this.session.prompt(text, {
            images: images.length ? images : undefined,
            streamingBehavior: "followUp",
          });
        } else {
          await this.session.prompt(text, {
            images: images.length ? images : undefined,
          });
        }
      } finally {
        this.streaming = false;
        this.emit({ type: "beide:status", streaming: false, mode: this.mode });
      }

      return { ok: true };
    } catch (err) {
      this.streaming = false;
      const message = err instanceof Error ? err.message : String(err);
      this.emit({ type: "error", error: message });
      return { ok: false, error: message };
    }
  }

  async abort(): Promise<void> {
    this.permissions.cancelAll("aborted");
    try {
      await this.session?.abort();
    } catch {
      // ignore
    }
    this.streaming = false;
    this.emit({ type: "beide:status", streaming: false, mode: this.mode, aborted: true });
  }

  respondPermission(id: string, allow: boolean, content?: string): void {
    this.permissions.respond(id, allow, content);
  }

  // ── internals ──────────────────────────────────────────────

  private emit(event: unknown): void {
    this.mainWindow?.webContents.send("agent:event", event);
  }

  private async ensureRuntime(): Promise<ModelRuntime> {
    if (this.modelRuntime) return this.modelRuntime;
    const agentDir = getPiAgentDir();
    try {
      await mkdir(agentDir, { recursive: true });
    } catch {
      // ok
    }
    // Reuse the same ~/.pi/agent auth + models-store as the pi CLI
    this.modelRuntime = await ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsStorePath: join(agentDir, "models-store.json"),
    });
    return this.modelRuntime;
  }

  private async ensureSession(): Promise<void> {
    if (this.session) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.initPromise = this.createSession();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async createSession(): Promise<void> {
    const cwd = this.workspaceRoot;
    if (!cwd) return;

    const agentDir = getPiAgentDir();
    const modelRuntime = await this.ensureRuntime();

    // Prefer xai / grok-4.5; fallback to any available
    let model =
      modelRuntime.getModel(PREFERRED_PROVIDER, PREFERRED_MODEL) ??
      modelRuntime.getModel("xai", "grok-4") ??
      modelRuntime.getModel("xai", "grok-3");

    if (!model) {
      const available = await modelRuntime.getAvailable();
      model = available[0];
    }

    if (model) {
      this.modelLabel = `${model.provider}/${model.id}`;
    } else {
      this.modelLabel = undefined;
    }

    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true },
    });

    const rules = await loadProjectRules(cwd);
    const treeSnap = await buildWorkspaceTreeSnapshot(cwd);
    const systemBase = buildSystemPrompt(this.mode);
    const systemPrompt = [systemBase, rules, treeSnap].filter(Boolean).join("\n\n");

    const resourceLoader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager,
      // Avoid loading interactive CLI extensions that expect a TTY
      noExtensions: true,
      systemPromptOverride: () => systemPrompt,
    });
    await resourceLoader.reload();

    const toolDefs = this.buildToolDefinitions(cwd);
    // Full exploration toolkit — agent must be able to read the whole repo
    const tools =
      this.mode === "plan"
        ? [
            "read",
            "bash",
            "ls",
            "find",
            "grep",
            "todo",
            "plan",
            "workspace_map",
            "project_info",
            "git_status",
          ]
        : [
            "read",
            "bash",
            "edit",
            "write",
            "ls",
            "find",
            "grep",
            "todo",
            "plan",
            "workspace_map",
            "project_info",
            "git_status",
          ];

    const { session, modelFallbackMessage } = await createAgentSession({
      cwd,
      agentDir,
      model,
      modelRuntime,
      tools,
      // ToolDefinition generics are invariant on renderCall args; runtime shapes match
      // custom write/edit/bash override builtins for permission + checkpoints
      customTools: toolDefs as never,
      resourceLoader,
      sessionManager: SessionManager.inMemory(cwd),
      settingsManager,
    });

    this.session = session;

    if (modelFallbackMessage) {
      this.emit({ type: "beide:model_fallback", message: modelFallbackMessage });
    }
    if (this.modelLabel) {
      this.emit({ type: "beide:model", model: this.modelLabel });
    }

    this.unsubscribe = session.subscribe((event) => {
      // Forward pi events as-is for the renderer to interpret
      this.emit(event);

      // Track streaming roughly
      if (event && typeof event === "object" && "type" in event) {
        const t = (event as { type: string }).type;
        if (t === "agent_start" || t === "turn_start") {
          this.streaming = true;
        }
        if (t === "agent_end" || t === "agent_settled") {
          this.streaming = false;
        }
      }
    });
  }

  /**
   * Custom tool definitions wrapping write/edit/bash with PermissionGateway + checkpoints.
   * Same tool names as builtins so they override via customTools registry merge.
   */
  private buildToolDefinitions(cwd: string) {
    const permissions = this.permissions;
    const checkpoints = this.checkpoints;
    const rel = (absolutePath: string) => toWorkspaceRelative(cwd, absolutePath);

    const writeOps = {
      writeFile: async (absolutePath: string, content: string) => {
        const pathLabel = rel(absolutePath);
        let before = "";
        try {
          before = await readFile(absolutePath, "utf-8");
        } catch {
          before = "";
        }

        await checkpoints.snapshot([pathLabel], `write ${pathLabel}`);

        const decision = await permissions.request({
          kind: "write",
          path: pathLabel,
          before,
          after: content,
          description: `Write file ${pathLabel}`,
        });

        if (!decision.allow) {
          throw new Error(`Write denied by user: ${pathLabel}`);
        }

        const finalContent = decision.content ?? content;
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, finalContent, "utf-8");
      },
      mkdir: async (dir: string) => {
        await mkdir(dir, { recursive: true });
      },
    };

    const editOps = {
      readFile: async (absolutePath: string) => readFile(absolutePath),
      writeFile: async (absolutePath: string, content: string) => {
        const pathLabel = rel(absolutePath);
        let before = "";
        try {
          before = await readFile(absolutePath, "utf-8");
        } catch {
          before = "";
        }

        await checkpoints.snapshot([pathLabel], `edit ${pathLabel}`);

        const decision = await permissions.request({
          kind: "edit",
          path: pathLabel,
          before,
          after: content,
          description: `Edit file ${pathLabel}`,
        });

        if (!decision.allow) {
          throw new Error(`Edit denied by user: ${pathLabel}`);
        }

        const finalContent = decision.content ?? content;
        await writeFile(absolutePath, finalContent, "utf-8");
      },
      access: async (absolutePath: string) => {
        await access(absolutePath);
      },
    };

    const localBash = createLocalBashOperations();
    const bashOps = {
      exec: async (
        command: string,
        bashCwd: string,
        options: {
          onData: (data: Buffer) => void;
          signal?: AbortSignal;
          timeout?: number;
          env?: NodeJS.ProcessEnv;
        },
      ) => {
        // Plan mode: allow only a small readonly-ish whitelist. Anything else is blocked.
        if (this.mode === "plan") {
          const trimmed = command.trim();
          const firstToken = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
          // Map cmd.exe builtins to their target command
          const cmd = firstToken.replace(/\.exe$/i, "");
          const READONLY_COMMANDS = new Set([
            "ls", "dir", "cat", "type", "head", "tail", "less", "more",
            "grep", "rg", "findstr", "find", "where", "which", "echo",
            "pwd", "cd", "pushd", "popd", "tree",
            "git",  // git itself is allowed; mutating subcommands blocked below
            "npm", "npx", "pnpm", "yarn", "bun", "deno",
            "wc", "sort", "uniq", "cut", "awk",
          ]);
          // Subcommands that mutate — block even on otherwise-allowed binaries
          const MUTATING_SUBCOMMANDS = new Set([
            "install", "i", "add", "remove", "rm", "uninstall", "un",
            "publish", "run", "exec", "execute",
            "commit", "push", "pull", "merge", "rebase", "cherry-pick",
            "reset", "clean", "checkout", "switch", "branch",
            "write", "delete", "del", "format",
          ]);
          if (!READONLY_COMMANDS.has(cmd)) {
            const msg = Buffer.from(
              `Blocked in plan mode: "${firstToken}" is not in the readonly whitelist. Switch to Agent mode.\n`,
            );
            options.onData(msg);
            return { exitCode: 1 };
          }
          // Block mutating subcommands on allowed binaries
          const subcommand = trimmed.split(/\s+/)[1]?.replace(/^:/, "").toLowerCase() ?? "";
          if (MUTATING_SUBCOMMANDS.has(subcommand)) {
            const msg = Buffer.from(
              `Blocked in plan mode: "${firstToken} ${subcommand}" looks mutating. Switch to Agent mode.\n`,
            );
            options.onData(msg);
            return { exitCode: 1 };
          }
          // Block shell redirections that write to disk
          if (command.includes(">>") || /[^|=>]\s*>\s*[^|]/.test(command)) {
            const msg = Buffer.from(
              "Blocked in plan mode: file redirection detected. Switch to Agent mode.\n",
            );
            options.onData(msg);
            return { exitCode: 1 };
          }
        }

        if (permissions.getMode() === "ask" && this.mode === "agent") {
          const decision = await permissions.request({
            kind: "bash",
            command,
            description: `Run command: ${command}`,
          });
          if (!decision.allow) {
            options.onData(Buffer.from("Command denied by user.\n"));
            return { exitCode: 1 };
          }
        }

        return localBash.exec(command, bashCwd, options);
      },
    };

    const todoItemSchema = Type.Object({
      content: Type.String(),
      status: Type.Union([
        Type.Literal("pending"),
        Type.Literal("in_progress"),
        Type.Literal("completed"),
      ]),
      activeForm: Type.Optional(Type.String()),
    });

    const todoTool = defineTool({
      name: "todo",
      label: "Todo",
      description:
        "Update the task checklist for the current work. Pass the full todos array each time.",
      promptSnippet: "todo: maintain a task checklist while working",
      parameters: Type.Object({
        todos: Type.Array(todoItemSchema),
      }),
      async execute(_id, params) {
        const text = JSON.stringify({ todos: params.todos }, null, 0);
        return {
          content: [{ type: "text" as const, text }],
          details: { todos: params.todos },
        };
      },
    });

    const planTool = defineTool({
      name: "plan",
      label: "Plan",
      description:
        "Publish a structured implementation plan (title + multi-step summary). Use in plan mode.",
      promptSnippet: "plan: publish a step-by-step plan card",
      parameters: Type.Object({
        title: Type.String(),
        summary: Type.String({
          description: "Numbered steps and outcome, plain text",
        }),
        id: Type.Optional(Type.String()),
      }),
      async execute(_id, params) {
        const plan = {
          id: params.id ?? `plan_${Date.now()}`,
          title: params.title,
          summary: params.summary,
        };
        const payload = { plan };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
          details: payload,
        };
      },
    });

    // ── beide plugins (custom tools) ─────────────────────────
    const workspaceMapTool = defineTool({
      name: "workspace_map",
      label: "Workspace map",
      description:
        "Fast project map: top-level entries and 1-level children for important dirs. Prefer this over many ls calls.",
      promptSnippet: "workspace_map: quick project structure",
      parameters: Type.Object({
        path: Type.Optional(
          Type.String({
            description: "Relative path to map (default: workspace root)",
          }),
        ),
        depth: Type.Optional(
          Type.Number({ description: "Depth 1–2 (default 2)" }),
        ),
      }),
      async execute(_id, params) {
        const rel = (params.path ?? ".").replace(/\\/g, "/").replace(/^\//, "");
        const depth = Math.min(2, Math.max(1, Number(params.depth ?? 2) || 2));
        const map = await buildQuickWorkspaceMap(cwd, rel === "." ? "" : rel, depth);
        const text = map.join("\n");
        return {
          content: [{ type: "text" as const, text: text || "(empty)" }],
          details: { path: rel || ".", entries: map.length, lines: map },
        };
      },
    });

    const projectInfoTool = defineTool({
      name: "project_info",
      label: "Project info",
      description:
        "Read package.json (or similar) and return name, scripts, dependencies summary.",
      promptSnippet: "project_info: package.json summary",
      parameters: Type.Object({
        file: Type.Optional(
          Type.String({
            description: "Manifest path relative to root (default package.json)",
          }),
        ),
      }),
      async execute(_id, params) {
        const file = (params.file ?? "package.json").replace(/\\/g, "/");
        const abs = join(cwd, file);
        try {
          const raw = await readFile(abs, "utf-8");
          const pkg = JSON.parse(raw) as Record<string, unknown>;
          const summary: Record<string, unknown> = {
            file,
            name: pkg.name ?? null,
            version: pkg.version ?? null,
            private: pkg.private ?? null,
            type: pkg.type ?? null,
            scripts:
              pkg.scripts && typeof pkg.scripts === "object"
                ? Object.keys(pkg.scripts as object)
                : [],
            dependencies:
              pkg.dependencies && typeof pkg.dependencies === "object"
                ? Object.keys(pkg.dependencies as object).slice(0, 80)
                : [],
            devDependencies:
              pkg.devDependencies && typeof pkg.devDependencies === "object"
                ? Object.keys(pkg.devDependencies as object).slice(0, 80)
                : [],
          };
          const text = JSON.stringify(summary, null, 2);
          return {
            content: [{ type: "text" as const, text }],
            details: summary,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const details: Record<string, unknown> = {
            file,
            error: msg,
            name: null,
            version: null,
            private: null,
            type: null,
            scripts: [],
            dependencies: [],
            devDependencies: [],
          };
          return {
            content: [
              {
                type: "text" as const,
                text: `Cannot read ${file}: ${msg}`,
              },
            ],
            details,
          };
        }
      },
    });

    const gitStatusTool = defineTool({
      name: "git_status",
      label: "Git status",
      description:
        "Readonly git snapshot: branch, status --short, and optional diff --stat. Prefer this over raw bash git.",
      promptSnippet: "git_status: branch + status + diff --stat",
      parameters: Type.Object({
        includeDiffStat: Type.Optional(
          Type.Boolean({
            description: "Include git diff --stat (default true)",
          }),
        ),
      }),
      async execute(_id, params) {
        const includeDiff = params.includeDiffStat !== false;
        const run = (cmd: string) =>
          runShellCommand(cmd, cwd, 15_000).then((r) => ({
            cmd,
            code: r.code,
            out: (r.stdout || r.stderr || "").trim(),
          }));
        const [branch, status, diff] = await Promise.all([
          run("git rev-parse --abbrev-ref HEAD"),
          run("git status --short"),
          includeDiff
            ? run("git diff --stat")
            : Promise.resolve({ cmd: "", code: 0, out: "" }),
        ]);
        const text = [
          `branch: ${branch.out || "(unknown)"}`,
          "",
          "## status",
          status.out || "(clean)",
          includeDiff ? "\n## diff --stat\n" + (diff.out || "(no diff)") : "",
        ]
          .filter(Boolean)
          .join("\n");
        const details = {
          branch: branch.out,
          status: status.out,
          diffStat: diff.out,
          dirty: Boolean(status.out),
        };
        return {
          content: [{ type: "text" as const, text }],
          details,
        };
      },
    });

    return [
      createReadToolDefinition(cwd),
      createWriteToolDefinition(cwd, { operations: writeOps }),
      createEditToolDefinition(cwd, { operations: editOps }),
      createBashToolDefinition(cwd, { operations: bashOps }),
      todoTool,
      planTool,
      workspaceMapTool,
      projectInfoTool,
      gitStatusTool,
    ];
  }

  private async teardownSession(): Promise<void> {
    this.permissions.cancelAll("workspace change");
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.session) {
      try {
        await this.session.abort();
      } catch {
        // ignore
      }
      try {
        this.session.dispose();
      } catch {
        // ignore
      }
      this.session = null;
    }
    this.streaming = false;
  }

  async dispose(): Promise<void> {
    await this.teardownSession();
    this.modelRuntime = null;
  }
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
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const MAX = 1_000_000;
    let settled = false;

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      if (stdoutTruncated) stdout += `\n[beide] stdout truncated to last 1MB`;
      if (stderrTruncated) stderr += `\n[beide] stderr truncated to last 1MB`;
      resolve({ code, stdout, stderr });
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
      void killTree().then(() => {
        stderr += "\n[beide] command timed out after 30s";
        finish(124);
      });
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
