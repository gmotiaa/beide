import { access, mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { BrowserWindow } from "electron";
import { Type } from "typebox";
import { Agent as UndiciAgent, setGlobalDispatcher } from "undici";
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

/** EchoGate requests need longer connect/body timeouts than Node undici defaults */
let httpDispatcherReady = false;
function ensureHttpDispatcher(): void {
  if (httpDispatcherReady) return;
  httpDispatcherReady = true;
  setGlobalDispatcher(
    new UndiciAgent({
      connect: { timeout: 60_000 },
      headersTimeout: 300_000,
      bodyTimeout: 300_000,
      keepAliveTimeout: 30_000,
    }),
  );
}
import type {
  AgentMode,
  AgentPromptPayload,
  ChatMessage,
  ChatMention,
  ProviderStatus,
} from "../../src/lib/types";
import {
  DEFAULT_MODEL_ID,
  ECHOGATE_BASE_URL,
  MODEL_CATALOG,
  findModel,
} from "../../src/lib/models";
import type { CheckpointService } from "./checkpoints";
import type { PermissionGateway } from "./permissions";
import {
  getPiAgentDir,
  getRulesCandidates,
  resolveRealInWorkspace,
  toWorkspaceRelative,
} from "./paths";
import type { SessionService } from "./sessions";
import type { SettingsService } from "./settings";
import { decryptProviderKey } from "./provider-key";
import { validatePlanCommand } from "./plan-command";

const PREFERRED_MODEL = DEFAULT_MODEL_ID;

/**
 * API keys MUST be read lazily at call time, not at module load.
 * In ESM, all imports are evaluated before the importing module's body runs,
 * so main.ts's loadEnvFile() hasn't executed yet when this module loads.
 * Capturing process.env at top level would always yield "".
 */
function echogateEnvKey(): string {
  return process.env.BEIDE_ECHOGATE_API_KEY ?? "";
}

const PROVIDER_LABELS: Record<ProviderStatus["id"], string> = {
  echogate: "beide Cloud",
};

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
const ZERO_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { ...ZERO_COST, total: 0 },
};

type PiAgentMessage = AgentSession["messages"][number];

/**
 * UI transcripts intentionally do not persist pi's provider-specific tool-call
 * envelopes. Hydrate only the conversational user/assistant text; orphaned
 * toolResult messages are rejected by several providers. History is bounded so
 * opening a large session cannot immediately overflow the model context.
 */
function transcriptToAgentMessages(
  history: ChatMessage[],
  model: { api: string; provider: string; id: string },
): PiAgentMessage[] {
  const selected: ChatMessage[] = [];
  let chars = 0;
  for (let index = history.length - 1; index >= 0 && selected.length < 120; index--) {
    const message = history[index]!;
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      !message.content.trim()
    ) {
      continue;
    }
    if (chars + message.content.length > 200_000 && selected.length > 0) break;
    selected.push(message);
    chars += message.content.length;
  }
  selected.reverse();

  return selected.map((message) => {
    if (message.role === "user") {
      return {
        role: "user",
        content: message.content,
        timestamp: message.createdAt,
      } as PiAgentMessage;
    }
    return {
      role: "assistant",
      content: [{ type: "text", text: message.content }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: ZERO_USAGE,
      stopReason: "stop",
      timestamp: message.createdAt,
    } as PiAgentMessage;
  });
}

const ECHOGATE_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  maxTokensField: "max_tokens" as const,
  supportsStrictMode: false,
  supportsLongCacheRetention: false,
};

const ECHOGATE_MODELS: Record<string, Record<string, unknown>> = Object.fromEntries(
  MODEL_CATALOG.filter((m) => m.provider === "echogate").map((m) => [
    m.id,
    {
      id: m.id,
      name: `${m.name} ${m.version}`,
      api: "openai-completions" as const,
      provider: "echogate" as const,
      baseUrl: ECHOGATE_BASE_URL,
      reasoning: false,
      input: (m.supportsImages ? ["text", "image"] : ["text"]) as Array<
        "text" | "image"
      >,
      cost: ZERO_COST,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      compat: ECHOGATE_COMPAT,
    },
  ]),
);

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
    "- memory — сохранить долговременный факт о проекте (архитектура, соглашения, грабли). Коротко, одна строка; попадёт в system prompt следующих сессий.",
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

/** Agent-maintained long-term notes, appended via the `memory` tool. */
const MEMORY_REL_PATH = ".beide/memory.md";
const MEMORY_MAX_CHARS = 8_000;

async function loadProjectMemory(cwd: string): Promise<string> {
  try {
    const text = await readFile(join(cwd, MEMORY_REL_PATH), "utf-8");
    if (!text.trim()) return "";
    return `# Project memory (agent-maintained, ${MEMORY_REL_PATH})\n${text.trim().slice(-MEMORY_MAX_CHARS)}`;
  } catch {
    return "";
  }
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
  const base = await resolveRealInWorkspace(cwd, relRoot);

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
      // Dotfiles stay out of the model's context: `.env` and friends hold
      // secrets and there is nothing useful in listing them.
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
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
  return `## Workspace file tree (snapshot)\n\n${body}${more}`;
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

/** Files above this size are never inlined into the prompt — read the head via the tool instead. */
const MAX_CONTEXT_FILE_BYTES = 2_000_000;

/** Best-effort inject of active editor buffer so agent doesn't re-read blindly. */
async function activeFileSnippet(
  cwd: string,
  activeFile?: string,
  editorContent?: string,
  maxChars = 24_000,
): Promise<string> {
  if (!activeFile) return "";
  try {
    let text: string;
    if (editorContent !== undefined) {
      text = editorContent;
    } else {
      const abs = await resolveRealInWorkspace(cwd, activeFile);
      if ((await stat(abs)).size > MAX_CONTEXT_FILE_BYTES) {
        return `## Active file\n\`${activeFile}\` (too large to inline — use read)\n\n`;
      }
      text = await readFile(abs, "utf-8");
    }
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

/**
 * Passing custom `operations` to the read tool replaces the SDK defaults whole,
 * including its image sniffer — re-detect by magic bytes so image reads keep
 * working instead of arriving as garbled text.
 */
function sniffImageMimeType(head: Buffer): string | null {
  const ascii = (offset: number, text: string) =>
    head.subarray(offset, offset + text.length).toString("latin1") === text;
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
  if (ascii(1, "PNG\r\n\x1a\n") && head[0] === 0x89) return "image/png";
  if (ascii(0, "GIF")) return "image/gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(0, "BM") && looksLikeBmpHeader(head)) return "image/bmp";
  return null;
}

/**
 * "BM" alone also opens plenty of ordinary text ("BMW notes", "BM_API_KEY=…"),
 * and a false positive here means the file is returned as a broken image
 * instead of its contents. Require a plausible DIB header too.
 */
function looksLikeBmpHeader(head: Buffer): boolean {
  if (head.length < 18) return false;
  const pixelDataOffset = head.readUInt32LE(10);
  const dibHeaderSize = head.readUInt32LE(14);
  if (dibHeaderSize !== 12 && (dibHeaderSize < 40 || dibHeaderSize > 124)) return false;
  return pixelDataOffset >= 14 + dibHeaderSize;
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
  private selectedModelId: string | null = null;
  private modelLabel: string | undefined;
  private modelRuntime: ModelRuntime | null = null;
  /** Last key the echogate provider was registered with, to skip no-op recomposes. */
  private registeredEchogateKey: string | null = null;
  /** Provider key delivered from Supabase after sign-in. Memory only. */
  private cloudEchogateKey: string | null = null;
  private modelSupportsImages = false;
  private initPromise: Promise<void> | null = null;
  private runtimePromise: Promise<ModelRuntime> | null = null;
  /** Serialize prompts — prevent concurrent session.prompt races */
  private promptChain: Promise<unknown> = Promise.resolve();

  private streamBuffer: unknown[] = [];
  private streamTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Session file the in-flight turn belongs to, captured when the prompt
   * starts. Events are tagged with it so the renderer can drop stream events
   * that arrive after the user switched to another chat — untagged they used
   * to be appended to (and then saved into) whatever transcript was open.
   */
  private currentTurnSessionId: string | null = null;
  private pendingTranscript: ChatMessage[] = [];
  private pendingRuntimeMessages: PiAgentMessage[] | null = null;

  constructor(
    private readonly settings: SettingsService,
    private readonly permissions: PermissionGateway,
    private readonly checkpoints: CheckpointService,
    private readonly sessions: SessionService,
  ) {}

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
    this.permissions.setMainWindow(win);
  }

  async onWorkspaceChanged(root: string | null): Promise<void> {
    // Serialize with prompt chain to prevent teardown mid-prompt
    const run = () => this.onWorkspaceChangedImpl(root);
    this.promptChain = this.promptChain.then(run, run);
    return this.promptChain as Promise<void>;
  }

  private async onWorkspaceChangedImpl(root: string | null): Promise<void> {
    await this.teardownSession({ reason: "workspace change" });
    this.pendingTranscript = [];
    this.pendingRuntimeMessages = null;
    this.currentTurnSessionId = null;
    this.workspaceRoot = root;
    this.checkpoints.setWorkspace(root);
    this.sessions.setWorkspace(root);
    if (root) {
      const s = await this.settings.get();
      this.mode = s.defaultAgentMode;
      this.permissions.setMode(s.permissionMode);
      void this.ensureRuntime();
    }
  }

  /** Bind the pi runtime to the transcript selected in the renderer. */
  async onSessionChanged(
    sessionId: string | null,
    history: ChatMessage[],
  ): Promise<void> {
    const run = async () => {
      await this.teardownSession({ reason: "chat session change" });
      this.pendingTranscript = sessionId ? [...history] : [];
      this.pendingRuntimeMessages = null;
      this.currentTurnSessionId = null;
    };
    this.promptChain = this.promptChain.then(run, run);
    return this.promptChain as Promise<void>;
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

  /** Credential status per provider, for the settings screen. */
  async getProviders(): Promise<ProviderStatus[]> {
    const runtime = await this.ensureRuntime();
    return this.providerStatuses(runtime);
  }

  private providerStatuses(runtime: ModelRuntime): ProviderStatus[] {
    return (Object.keys(PROVIDER_LABELS) as ProviderStatus["id"][]).map((id) => {
      const status = runtime.getProviderAuthStatus(id);
      return {
        id,
        label: PROVIDER_LABELS[id],
        connected: status.configured,
        kind: status.configured
          ? runtime.isUsingOAuth(id)
            ? "oauth"
            : "api_key"
          : null,
      };
    });
  }

  async setMode(mode: AgentMode): Promise<void> {
    // Serialized through promptChain: switching while createSession is still
    // in flight used to leave plan mode holding an agent-mode session (with
    // write/edit tools) until the next teardown.
    const run = () => this.setModeImpl(mode);
    this.promptChain = this.promptChain.then(run, run);
    return this.promptChain as Promise<void>;
  }

  private async setModeImpl(mode: AgentMode): Promise<void> {
    if (this.mode === mode && this.session) return;
    this.mode = mode;
    // Rebuild session so tool allowlist + system prompt match mode
    if (this.workspaceRoot) {
      await this.teardownSession({
        preserveRuntimeMessages: true,
        reason: "agent mode change",
      });
      // Session recreated lazily on next prompt
    }
  }

  async setModel(modelId: string): Promise<void> {
    const run = () => this.setModelImpl(modelId);
    this.promptChain = this.promptChain.then(run, run);
    return this.promptChain as Promise<void>;
  }

  private async setModelImpl(modelId: string): Promise<void> {
    const id = modelId.trim();
    if (!id) return;
    this.selectedModelId = id;
    this.modelLabel = id;
    if (this.workspaceRoot) {
      await this.teardownSession({
        preserveRuntimeMessages: true,
        reason: "model change",
      });
    }
    this.emit({ type: "beide:model", model: id });
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
        // Already inside promptChain — calling setMode() here would deadlock.
        await this.setModeImpl(payload.mode);
      }

      await this.ensureSession();
      // Hold the session locally: teardownSession() can null the field while we
      // await below, which would turn the later reads into a TypeError.
      const session = this.session;
      if (!session) {
        return { ok: false, error: "Agent session failed to start" };
      }

      const s = await this.settings.get();
      this.permissions.setMode(s.permissionMode);

      const activeSnippet = await activeFileSnippet(
        this.workspaceRoot,
        payload.activeFile,
        payload.activeFileContent,
      );
      // Editor diagnostics ride along so the agent sees the same squiggles the
      // user does — before AND after its own edits (the next prompt refreshes).
      const diagnosticsBlock = payload.diagnostics
        ? `## Editor diagnostics (open tabs)\n${payload.diagnostics}\n\n`
        : "";
      const codebaseBlock = payload.codebaseContext
        ? `## Codebase search results (@codebase)\n${payload.codebaseContext}\n\n`
        : "";
      const preamble = [
        openFilesPreamble(payload.activeFile, payload.openFiles),
        activeSnippet,
        diagnosticsBlock,
        codebaseBlock,
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
          const abs = await resolveRealInWorkspace(this.workspaceRoot, m.path);
          if ((await stat(abs)).size > MAX_CONTEXT_FILE_BYTES) {
            mentionBodies += `\n### File: ${m.path}\n(too large to inline — use read)\n`;
            continue;
          }
          const text = await readFile(abs, "utf-8");
          const clipped =
            text.length > 80_000 ? `${text.slice(0, 80_000)}\n…[truncated]` : text;
          mentionBodies += `\n### File: ${m.path}\n\`\`\`\n${clipped}\n\`\`\`\n`;
        } catch {
          mentionBodies += `\n### File: ${m.path}\n(unreadable)\n`;
        }
      }

      const text = `${preamble}${mentionBodies}${userText}`.trim();

      const rawImages = (payload.images ?? []).slice(0, 8).map((img) => ({
        type: "image" as const,
        data: img.data,
        mimeType: img.mimeType,
      }));

      // Drop images if the current model doesn't support image input
      const images = this.modelSupportsImages ? rawImages : [];
      if (rawImages.length && !this.modelSupportsImages) {
        this.emit({
          type: "beide:warning",
          message: `Модель ${this.modelLabel ?? "unknown"} не поддерживает изображения — картинки были отброшены.`,
        });
      }

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
      // appendMessages ensured an active session — that is the file this turn
      // streams into, no matter what the user opens meanwhile.
      this.currentTurnSessionId = this.sessions.getActiveId();

      this.streaming = true;
      this.emit({ type: "beide:status", streaming: true, mode: this.mode });

      try {
        if (session.isStreaming) {
          await session.prompt(text, {
            images: images.length ? images : undefined,
            streamingBehavior: "followUp",
          });
        } else {
          await session.prompt(text, {
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

  /**
   * The window can be gone while the agent is still streaming (user closed it
   * mid-turn). `webContents.send` on a destroyed window throws, so every
   * outbound event goes through here.
   */
  private send(event: unknown): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) return;
    // Tag with the turn's session (not the currently active one: the user may
    // have switched sessions while this turn was still streaming).
    const sessionId = this.currentTurnSessionId ?? this.sessions.getActiveId();
    const tagged =
      sessionId && event && typeof event === "object" && !Array.isArray(event)
        ? { ...(event as Record<string, unknown>), beideSessionId: sessionId }
        : event;
    try {
      win.webContents.send("agent:event", tagged);
    } catch {
      // renderer torn down between the check and the send
    }
  }

  private emit(event: unknown): void {
    if (this.isTextDeltaEvent(event)) {
      this.streamBuffer.push(event);
      if (!this.streamTimer) {
        this.streamTimer = setTimeout(() => this.flushStreamBuffer(), 30);
      }
    } else {
      this.flushStreamBuffer();
      this.send(event);
    }
  }

  private isTextDeltaEvent(event: unknown): boolean {
    if (!event || typeof event !== "object") return false;
    const ev = event as Record<string, unknown>;
    if (ev.type === "text_delta" || ev.type === "content_delta") return true;
    if (ev.type === "message_update") {
      const ame = (ev.assistantMessageEvent as Record<string, unknown>) ?? {};
      const ameType = String(ame.type ?? "").toLowerCase();
      if (ameType === "text_delta" || ameType === "text") return true;
    }
    return false;
  }

  private flushStreamBuffer(): void {
    if (this.streamTimer) {
      clearTimeout(this.streamTimer);
      this.streamTimer = null;
    }
    if (this.streamBuffer.length === 0) return;

    const events = this.streamBuffer;
    this.streamBuffer = [];

    if (events.length === 1) {
      this.send(events[0]);
      return;
    }

    let combinedDelta = "";
    let sampleEvent: Record<string, unknown> | null = null;
    let canCombine = true;

    for (const ev of events) {
      const r = ev as Record<string, unknown>;
      if (r.type === "message_update") {
        const ame = r.assistantMessageEvent as Record<string, unknown> | undefined;
        const ameType = String(ame?.type ?? "").toLowerCase();
        if (ameType === "text_delta" || ameType === "text") {
          const delta =
            typeof ame?.delta === "string"
              ? ame.delta
              : typeof ame?.text === "string"
                ? ame.text
                : typeof ame?.content === "string"
                  ? ame.content
                  : "";
          combinedDelta += delta;
          sampleEvent = r;
          continue;
        }
      }
      canCombine = false;
      break;
    }

    if (canCombine && sampleEvent && combinedDelta) {
      const ame = (sampleEvent.assistantMessageEvent as Record<string, unknown>) ?? {};
      // `text`/`content` on the sample still hold only the LAST chunk. Leaving
      // them in place would let a consumer that prefers those fields drop every
      // batched delta but the final one — carry the combined text in all three.
      const batched: Record<string, unknown> = { ...ame, delta: combinedDelta };
      if ("text" in ame) batched.text = combinedDelta;
      if ("content" in ame) batched.content = combinedDelta;
      this.send({ ...sampleEvent, assistantMessageEvent: batched });
    } else {
      for (const ev of events) {
        this.send(ev);
      }
    }
  }

  /** .env override is the dev escape hatch; the cloud-delivered key is the norm. */
  private effectiveEchogateKey(): string {
    return echogateEnvKey().trim() || this.cloudEchogateKey || "";
  }

  /**
   * Install the provider key fetched from Supabase by the renderer. Arrives as
   * AES-256-GCM ciphertext; the plaintext lives only in this process's memory
   * (never on disk, and stripSecretEnv keeps it out of agent-driven shells —
   * it is installed as a runtime override, not an env var).
   */
  async installEncryptedProviderKey(
    ciphertext: string,
  ): Promise<{ ok: boolean; error?: string }> {
    let key: string;
    try {
      key = decryptProviderKey(ciphertext);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[agent] provider key decrypt failed:", message);
      return { ok: false, error: "Provider key payload is invalid" };
    }
    this.cloudEchogateKey = key;
    // Re-arm an already-created runtime; otherwise the next ensureRuntime()
    // picks the key up on construction.
    if (this.modelRuntime) {
      this.registerEchoGateProvider(this.modelRuntime, this.effectiveEchogateKey());
      await this.syncRuntimeApiKey(
        this.modelRuntime,
        "echogate",
        this.effectiveEchogateKey(),
      );
    }
    return { ok: true };
  }

  /**
   * One-shot, non-agentic completion straight against the gateway — powers
   * inline edits, ghost-text and commit messages, where spinning up a pi
   * session (system prompt + tools + history) would be pure overhead. Uses
   * the same in-memory key as the agent; the renderer never sees it.
   */
  async complete(opts: {
    prompt: string;
    system?: string;
    model?: string;
    maxTokens?: number;
  }): Promise<{ ok: boolean; text?: string; error?: string }> {
    const key = this.effectiveEchogateKey();
    if (!key) return { ok: false, error: "Provider key not available yet" };
    const model = findModel(opts.model ?? "")?.id ?? "gemini-3.6-flash";
    const messages: Array<{ role: string; content: string }> = [];
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: opts.prompt });
    try {
      ensureHttpDispatcher();
      const res = await fetch(`${ECHOGATE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: Math.min(Math.max(opts.maxTokens ?? 1024, 16), 8192),
          stream: false,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        return { ok: false, error: `Gateway ${res.status}: ${(await res.text()).slice(0, 300)}` };
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content;
      if (typeof text !== "string" || !text) {
        return { ok: false, error: "Gateway returned no content" };
      }
      return { ok: true, text };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Cheap reachability probe for the status-bar health badge. */
  async probeGateway(): Promise<{ ok: boolean; latencyMs: number | null }> {
    const started = Date.now();
    try {
      const res = await fetch(ECHOGATE_BASE_URL.replace(/\/v1\/?$/, "/"), {
        signal: AbortSignal.timeout(6_000),
      });
      return { ok: res.ok, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: null };
    }
  }

  private async ensureRuntime(): Promise<ModelRuntime> {
    ensureHttpDispatcher();
    const echogateKey = this.effectiveEchogateKey();
    if (this.modelRuntime) {
      this.registerEchoGateProvider(this.modelRuntime, echogateKey);
      await this.syncRuntimeApiKey(this.modelRuntime, "echogate", echogateKey);
      return this.modelRuntime;
    }
    // Share runtime construction so concurrent status/prompt calls do not
    // create competing SDK instances and file watchers.
    if (this.runtimePromise) return this.runtimePromise;
    this.runtimePromise = this.createRuntime(echogateKey);
    try {
      return await this.runtimePromise;
    } finally {
      this.runtimePromise = null;
    }
  }

  /**
   * `setRuntimeApiKey` alone only stores a credential; auth resolution for a
   * request still needs "echogate" to exist as a provider, so an unregistered
   * id fails with pi's "No API key found" at prompt time. Registration also
   * carries the key: pi resolves custom-provider keys from the provider
   * config (see providers.md → Resolution Order).
   */
  private registerEchoGateProvider(runtime: ModelRuntime, key: string): void {
    if (this.registeredEchogateKey === key) return;
    runtime.registerProvider("echogate", {
      name: "EchoGate",
      baseUrl: ECHOGATE_BASE_URL,
      api: "openai-completions",
      authHeader: true,
      ...(key.trim() ? { apiKey: key } : {}),
      models: MODEL_CATALOG.map((m) => ({
        id: m.id,
        name: `${m.name} ${m.version}`,
        reasoning: false,
        input: (m.supportsImages ? ["text", "image"] : ["text"]) as Array<
          "text" | "image"
        >,
        cost: ZERO_COST,
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
        compat: ECHOGATE_COMPAT,
      })),
    });
    this.registeredEchogateKey = key;
  }

  private async syncRuntimeApiKey(
    runtime: ModelRuntime,
    provider: string,
    key: string,
  ): Promise<void> {
    if (key.trim()) {
      await runtime.setRuntimeApiKey(provider, key);
      return;
    }
    // ModelRuntime treats even an empty override as configured. Remove only
    // our ephemeral layer and let pi-owned OAuth/API credentials remain intact.
    if (runtime.getProviderAuthStatus(provider).source === "runtime") {
      await runtime.removeRuntimeApiKey(provider);
    }
  }

  private async createRuntime(echogateKey: string): Promise<ModelRuntime> {
    const agentDir = getPiAgentDir();
    try {
      await mkdir(agentDir, { recursive: true });
    } catch {
      // ok
    }
    const runtime = await ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json"),
      modelsStorePath: join(agentDir, "models-store.json"),
    });
    this.registerEchoGateProvider(runtime, echogateKey);
    await this.syncRuntimeApiKey(runtime, "echogate", echogateKey);
    this.modelRuntime = runtime;
    return runtime;
  }

  /** Resolve a picker id to an explicit EchoGate OpenAI-compatible model. */
  private async resolveModel(
    _modelRuntime: ModelRuntime,
    modelId: string | null,
  ): Promise<any | undefined> {
    if (!modelId) return undefined;
    const catalogId = findModel(modelId)?.id;
    return catalogId && ECHOGATE_MODELS[catalogId]
      ? { ...ECHOGATE_MODELS[catalogId] }
      : undefined;
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

    const providers = this.providerStatuses(modelRuntime);
    if (!providers.some((provider) => provider.connected)) {
      console.error(
        "[agent] no provider credentials — cloud key not delivered yet (sign in) and no BEIDE_ECHOGATE_API_KEY dev override",
      );
      this.emit({
        type: "beide:warning",
        message: "Ключ провайдера ещё не получен из облака. Проверьте вход в аккаунт и подключение к сети.",
      });
    }

    if (!this.selectedModelId) {
      this.selectedModelId = PREFERRED_MODEL;
    }

    const requestedModelId = this.selectedModelId;
    const connected = new Set(
      providers.filter((provider) => provider.connected).map((provider) => provider.id),
    );
    const requestedEntry = findModel(requestedModelId);
    const connectedFallback = MODEL_CATALOG.find((entry) => connected.has(entry.provider));
    const effectiveModelId =
      requestedEntry && !connected.has(requestedEntry.provider) && connectedFallback
        ? connectedFallback.id
        : requestedModelId;
    let model = await this.resolveModel(modelRuntime, effectiveModelId);

    if (effectiveModelId !== requestedModelId && model) {
      this.emit({
        type: "beide:warning",
        message: `Провайдер модели ${requestedModelId} не подключён — работаю на ${model.id}.`,
      });
    }

    if (!model) {
      console.warn(`[agent] model not found: ${requestedModelId}`);
      model = await this.resolveModel(modelRuntime, PREFERRED_MODEL);
      // The picker silently snapped back to the fallback and looked like the
      // choice had been ignored — say out loud that the pick was unavailable.
      if (model) {
        this.emit({
          type: "beide:warning",
          message: `Модель ${requestedModelId} недоступна (нет учётных данных провайдера или её нет в каталоге) — работаю на ${model.id}.`,
        });
      }
    }

    if (model) {
      this.modelLabel = model.id;
      this.modelSupportsImages = Array.isArray(model.input) && model.input.includes("image");
      console.log(
        `[agent] request model=${JSON.stringify(model.id)} baseUrl=${model.baseUrl ?? ""} provider=${model.provider} images=${this.modelSupportsImages}`,
      );
    } else {
      this.modelLabel = undefined;
      this.modelSupportsImages = false;
      console.warn("[agent] no model available");
    }

    const settingsManager = SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: {
        enabled: true,
        provider: {
          // Generous for slow generations, but not so long that a hung
          // gateway looks like endless "thinking" — 180s × 2 retries kept
          // users staring at a shimmer for ~9 minutes during an outage.
          timeoutMs: 90_000,
          maxRetries: 2,
        },
      },
      httpIdleTimeoutMs: 300_000,
    });

    const rules = await loadProjectRules(cwd);
    const memory = await loadProjectMemory(cwd);
    const treeSnap = await buildWorkspaceTreeSnapshot(cwd);
    const systemPrompt = [buildSystemPrompt(this.mode), rules, memory, treeSnap]
      .filter(Boolean)
      .join("\n\n");

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
            "memory",
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
            "memory",
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

    const restoredMessages =
      this.pendingRuntimeMessages ?? transcriptToAgentMessages(this.pendingTranscript, model);
    if (restoredMessages.length) {
      session.agent.state.messages = [...restoredMessages];
    }
    this.pendingRuntimeMessages = null;
    this.pendingTranscript = [];

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
        // Billing charges what the provider actually metered, not the
        // renderer's chars/3.2 guess — every assistant message carries its
        // real usage.
        if (t === "message_end") {
          const message = (
            event as {
              message?: {
                role?: string;
                usage?: { input?: number; output?: number; totalTokens?: number };
              };
            }
          ).message;
          if (message?.role === "assistant" && message.usage) {
            const u = message.usage;
            const total =
              typeof u.totalTokens === "number" && Number.isFinite(u.totalTokens) && u.totalTokens > 0
                ? u.totalTokens
                : (Number(u.input) || 0) + (Number(u.output) || 0);
            if (total > 0) {
              this.emit({ type: "beide:usage", tokens: Math.round(total) });
            }
          }
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
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        const pathLabel = rel(safePath);
        let before = "";
        try {
          before = await readFile(safePath, "utf-8");
        } catch {
          before = "";
        }

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

        // After the grant: a denied write must not burn a checkpoint slot.
        await checkpoints.snapshot([pathLabel], `write ${pathLabel}`);

        const finalContent = decision.content ?? content;
        await mkdir(dirname(safePath), { recursive: true });
        await writeFile(safePath, finalContent, "utf-8");
      },
      mkdir: async (dir: string) => {
        const safeDir = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, dir));
        await mkdir(safeDir, { recursive: true });
      },
    };

    const editOps = {
      readFile: async (absolutePath: string) => {
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        return readFile(safePath);
      },
      writeFile: async (absolutePath: string, content: string) => {
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        const pathLabel = rel(safePath);
        let before = "";
        try {
          before = await readFile(safePath, "utf-8");
        } catch {
          before = "";
        }

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

        // After the grant: a denied edit must not burn a checkpoint slot.
        await checkpoints.snapshot([pathLabel], `edit ${pathLabel}`);

        const finalContent = decision.content ?? content;
        await writeFile(safePath, finalContent, "utf-8");
      },
      access: async (absolutePath: string) => {
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        await access(safePath);
      },
    };

    // Default read operations hit the raw filesystem, so the tool could read any
    // absolute path on the machine. Constrain it the same way write/edit are.
    const readOps = {
      readFile: async (absolutePath: string) => {
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        // Secret guard: .env and friends reach the model (and thus the
        // provider) verbatim otherwise. Values are masked, key names stay —
        // enough for the agent to reason about config without exfiltrating it.
        if (SECRET_FILE_RE.test(safePath)) {
          const text = (await readFile(safePath)).toString("utf-8");
          this.emit({
            type: "beide:warning",
            message: `Агент читает файл с секретами (${rel(safePath)}) — значения замаскированы.`,
          });
          return Buffer.from(maskSecretValues(text), "utf-8");
        }
        return readFile(safePath);
      },
      access: async (absolutePath: string) => {
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        await access(safePath);
      },
      detectImageMimeType: async (absolutePath: string) => {
        const safePath = await resolveRealInWorkspace(cwd, toWorkspaceRelative(cwd, absolutePath));
        const handle = await open(safePath, "r");
        try {
          // 32 bytes: enough for the RIFF/WEBP tag at 8 and the BMP DIB header at 14.
          const head = Buffer.alloc(32);
          const { bytesRead } = await handle.read(head, 0, 32, 0);
          return sniffImageMimeType(head.subarray(0, bytesRead));
        } finally {
          await handle.close();
        }
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
        // Plan mode has a deliberately tiny, separately tested shell grammar.
        if (this.mode === "plan") {
          const rejection = validatePlanCommand(command);
          if (rejection) {
            options.onData(Buffer.from(`${rejection} Switch to Agent mode.\n`));
            return { exitCode: 1 };
          }
        }

        // The gate is about the *permission* setting, not the agent mode. Plan
        // mode used to skip it entirely, so every whitelisted command ran
        // unannounced — the whitelist was the only thing standing in the way.
        if (permissions.getMode() === "ask") {
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

        // pi hands us `{...process.env}` here, so the model could just echo the
        // provider keys back out of the shell it drives.
        const safeEnv = stripSecretEnv(options.env ?? process.env);
        if (this.mode === "plan") safeEnv.GIT_OPTIONAL_LOCKS = "0";
        return localBash.exec(command, bashCwd, {
          ...options,
          env: safeEnv,
        });
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
        try {
          const abs = await resolveRealInWorkspace(cwd, file);
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

    const memoryTool = defineTool({
      name: "memory",
      label: "Memory",
      description:
        "Append a durable project fact to the agent memory (.beide/memory.md): architecture decisions, conventions, gotchas. One short line per fact; it is injected into future system prompts.",
      promptSnippet: "memory: save a durable project fact for future sessions",
      parameters: Type.Object({
        note: Type.String({ description: "One concise fact, plain text" }),
      }),
      async execute(_id, params) {
        const note = params.note.trim().replace(/\s+/g, " ").slice(0, 500);
        if (!note) {
          return {
            content: [{ type: "text" as const, text: "Empty note ignored." }],
            details: { note: "" },
          };
        }
        const abs = join(cwd, MEMORY_REL_PATH);
        let current = "";
        try {
          current = await readFile(abs, "utf-8");
        } catch {
          // first note
        }
        let next = `${current.trimEnd()}\n- ${note}\n`.trimStart();
        // Oldest lines fall off — memory is a working set, not an archive.
        if (next.length > MEMORY_MAX_CHARS) {
          const lines = next.split("\n");
          while (lines.length > 1 && lines.join("\n").length > MEMORY_MAX_CHARS) {
            lines.shift();
          }
          next = lines.join("\n");
        }
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, next, "utf-8");
        return {
          content: [{ type: "text" as const, text: `Remembered: ${note}` }],
          details: { note },
        };
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
      createReadToolDefinition(cwd, { operations: readOps }),
      createWriteToolDefinition(cwd, { operations: writeOps }),
      createEditToolDefinition(cwd, { operations: editOps }),
      createBashToolDefinition(cwd, { operations: bashOps }),
      todoTool,
      planTool,
      workspaceMapTool,
      projectInfoTool,
      gitStatusTool,
      memoryTool,
    ];
  }

  private async teardownSession(options?: {
    preserveRuntimeMessages?: boolean;
    reason?: string;
  }): Promise<void> {
    this.flushStreamBuffer();
    this.permissions.cancelAll(options?.reason ?? "session teardown");
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.session) {
      if (options?.preserveRuntimeMessages) {
        this.pendingRuntimeMessages = [...this.session.messages];
      }
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
    await this.teardownSession({ reason: "application shutdown" });
    this.modelRuntime = null;
  }
}

/**
 * The main process env carries provider credentials (loaded from .env). A child
 * shell the model can drive must not be able to echo them back, so anything
 * that looks like a credential is stripped before spawn.
 */
const SECRET_ENV_KEYS = new Set([
  "BEIDE_ECHOGATE_API_KEY",
  "BEIDE_ADMIN_EMAIL",
  "BEIDE_ADMIN_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const SECRET_ENV_RE = /_API_KEY$|_KEY$|TOKEN|SECRET|PASSWORD|PASSWD/i;

/** Files whose contents are masked before they reach the model. */
const SECRET_FILE_RE =
  /(^|[\\/])\.env(\.[^\\/]*)?$|\.pem$|(^|[\\/])[^\\/]*(secrets?|credentials)[^\\/]*\.(json|ya?ml|toml|env|txt)$/i;

/** `KEY=value` / `"key": "value"`-style values become ***; key names survive. */
function maskSecretValues(text: string): string {
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

function buildChildEnv(): NodeJS.ProcessEnv {
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
