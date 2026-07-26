import { access, mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
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

/** NVIDIA (and similar) need longer connect/body timeouts than Node undici defaults */
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
  ANTHROPIC_BASE_URL,
  DEFAULT_MODEL_ID,
  GOOGLE_BASE_URL,
  MODEL_CATALOG,
  NVIDIA_BASE_URL,
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
import type { UsageService } from "./usage";

const PREFERRED_MODEL = DEFAULT_MODEL_ID;
const XAI_FALLBACK_MODEL = "grok-4.5";

/**
 * API keys MUST be read lazily at call time, not at module load.
 * In ESM, all imports are evaluated before the importing module's body runs,
 * so main.ts's loadEnvFile() hasn't executed yet when this module loads.
 * Capturing process.env at top level would always yield "".
 */
function googleApiKey(): string {
  return process.env.BEIDE_GOOGLE_API_KEY ?? "";
}
function nvidiaApiKey(): string {
  return process.env.BEIDE_NVIDIA_API_KEY ?? "";
}

/**
 * Credentials pi keeps in ~/.pi/agent/auth.json. Only the shape is inspected —
 * beide never reads, copies or logs the token itself.
 */
async function readStoredAuth(): Promise<Record<string, { type?: string }>> {
  try {
    const raw = await readFile(join(getPiAgentDir(), "auth.json"), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, { type?: string }>;
  } catch {
    return {};
  }
}

/**
 * Which providers can actually serve a request right now. Anthropic and xAI
 * come from a `pi auth login` (subscription OAuth or a pasted key); Google and
 * NVIDIA come from beide's own .env, and are mirrored into auth.json later.
 */
export async function readProviderStatus(): Promise<ProviderStatus[]> {
  const auth = await readStoredAuth();
  const stored = (id: string): ProviderStatus["kind"] => {
    const type = auth[id]?.type;
    return type === "oauth" || type === "api_key" ? type : null;
  };
  const fromEnv = (id: string, key: string): ProviderStatus => ({
    id: id as ProviderStatus["id"],
    label: PROVIDER_LABELS[id as ProviderStatus["id"]],
    connected: Boolean(key) || stored(id) !== null,
    kind: key ? "api_key" : stored(id),
  });
  return [
    {
      id: "anthropic",
      label: PROVIDER_LABELS.anthropic,
      connected: stored("anthropic") !== null,
      kind: stored("anthropic"),
    },
    fromEnv("nvidia", nvidiaApiKey()),
    fromEnv("google", googleApiKey()),
    {
      id: "xai",
      label: PROVIDER_LABELS.xai,
      connected: stored("xai") !== null,
      kind: stored("xai"),
    },
  ];
}

const PROVIDER_LABELS: Record<ProviderStatus["id"], string> = {
  anthropic: "Anthropic",
  nvidia: "NVIDIA NIM",
  google: "Google Gemini",
  xai: "xAI",
};

const ZERO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

/**
 * OpenAI-compat for integrate.api.nvidia.com.
 * supportsUsageInStreaming:false — some NIM endpoints mishandle stream_options.
 * maxTokensField: max_tokens — required (not max_completion_tokens).
 */
const NVIDIA_COMPAT = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  supportsUsageInStreaming: false,
  maxTokensField: "max_tokens" as const,
  supportsStrictMode: false,
  supportsLongCacheRetention: false,
};

/**
 * NIM model descriptors, derived from the shared catalog so the picker and the
 * resolver can never disagree. `body.model` is exactly the catalog id.
 */
const NVIDIA_MODELS: Record<string, Record<string, unknown>> = Object.fromEntries(
  MODEL_CATALOG.filter((m) => m.provider === "nvidia").map((m) => [
    m.id,
    {
      id: m.id,
      name: `${m.name} ${m.version}`,
      api: "openai-completions" as const,
      provider: "nvidia" as const,
      baseUrl: NVIDIA_BASE_URL,
      reasoning: false,
      input: m.supportsImages
        ? (["text", "image"] as Array<"text" | "image">)
        : (["text"] as Array<"text" | "image">),
      cost: ZERO_COST,
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
      headers: { "NVCF-POLL-SECONDS": "3600" },
      compat: NVIDIA_COMPAT,
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

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // missing or corrupt — start fresh
  }
  return {};
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp_${process.pid}`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, path);
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
    // Serialize with prompt chain to prevent teardown mid-prompt
    const run = () => this.onWorkspaceChangedImpl(root);
    this.promptChain = this.promptChain.then(run, run);
    return this.promptChain as Promise<void>;
  }

  private async onWorkspaceChangedImpl(root: string | null): Promise<void> {
    await this.teardownSession();
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
  getProviders(): Promise<ProviderStatus[]> {
    return readProviderStatus();
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
      await this.teardownSession();
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
      await this.teardownSession();
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

  private async setupCustomProviders(agentDir: string): Promise<void> {
    try {
      const GOOGLE_API_KEY = googleApiKey();
      const NVIDIA_API_KEY = nvidiaApiKey();
      if (GOOGLE_API_KEY) process.env.GEMINI_API_KEY = GOOGLE_API_KEY;
      if (NVIDIA_API_KEY) process.env.NVIDIA_API_KEY = NVIDIA_API_KEY;
      // Nothing to mirror — leave pi's files exactly as the user (or pi CLI)
      // left them.
      if (!GOOGLE_API_KEY && !NVIDIA_API_KEY) return;

      const authPath = join(agentDir, "auth.json");
      const modelsJsonPath = join(agentDir, "models.json");

      // ~/.pi/agent/auth.json and models.json are shared with the pi CLI and
      // any other tool the user runs. Only ever ADD/refresh the providers beide
      // owns a .env key for; an empty .env key must not delete a credential the
      // user configured elsewhere. Writes are tmp+rename: these files hold the
      // user's OAuth tokens, and a crash mid-write would destroy them all.
      const authData = await readJsonObject(authPath);
      if (GOOGLE_API_KEY) authData.google = { type: "api_key", key: GOOGLE_API_KEY };
      if (NVIDIA_API_KEY) authData.nvidia = { type: "api_key", key: NVIDIA_API_KEY };
      await writeJsonAtomic(authPath, authData);

      // Auth only — never re-list NIM models here (overlay drops baseUrl → 404 on wrong host)
      const modelsConfig = await readJsonObject(modelsJsonPath);
      const providers =
        modelsConfig.providers && typeof modelsConfig.providers === "object"
          ? (modelsConfig.providers as Record<string, unknown>)
          : {};
      if (GOOGLE_API_KEY) providers.google = { apiKey: GOOGLE_API_KEY };
      if (NVIDIA_API_KEY) {
        providers.nvidia = {
          apiKey: NVIDIA_API_KEY,
          baseUrl: NVIDIA_BASE_URL,
          api: "openai-completions",
        };
      }
      modelsConfig.providers = providers;
      await writeJsonAtomic(modelsJsonPath, modelsConfig);
    } catch (e) {
      console.error("[setupCustomProviders error]:", e);
    }
  }

  private async ensureRuntime(): Promise<ModelRuntime> {
    ensureHttpDispatcher();
    const GOOGLE_API_KEY = googleApiKey();
    const NVIDIA_API_KEY = nvidiaApiKey();
    if (this.modelRuntime) {
      // Always refresh runtime key (user may have rotated nvapi-…)
      await this.modelRuntime.setRuntimeApiKey("nvidia", NVIDIA_API_KEY);
      await this.modelRuntime.setRuntimeApiKey("google", GOOGLE_API_KEY);
      return this.modelRuntime;
    }
    // Two concurrent callers would both write auth.json/models.json and could
    // interleave into a corrupt file — share the first in-flight creation.
    if (this.runtimePromise) return this.runtimePromise;
    this.runtimePromise = this.createRuntime(GOOGLE_API_KEY, NVIDIA_API_KEY);
    try {
      return await this.runtimePromise;
    } finally {
      this.runtimePromise = null;
    }
  }

  private async createRuntime(
    googleKey: string,
    nvidiaKey: string,
  ): Promise<ModelRuntime> {
    const agentDir = getPiAgentDir();
    try {
      await mkdir(agentDir, { recursive: true });
    } catch {
      // ok
    }
    await this.setupCustomProviders(agentDir);
    const runtime = await ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json"),
      modelsStorePath: join(agentDir, "models-store.json"),
    });
    await runtime.setRuntimeApiKey("google", googleKey);
    await runtime.setRuntimeApiKey("nvidia", nvidiaKey);
    this.modelRuntime = runtime;
    return runtime;
  }

  /**
   * Resolve picker id → model for createAgentSession.
   * NVIDIA body.model is EXACTLY the picker id (e.g. deepseek-ai/deepseek-v4-pro).
   * Always force baseUrl — empty baseUrl from models-store causes 404 on wrong host.
   */
  private async resolveModel(
    modelRuntime: ModelRuntime,
    modelId: string | null,
  ): Promise<any | undefined> {
    if (!modelId) return undefined;
    const id = modelId.trim();
    if (!id) return undefined;

    // Accept `provider/id` from the picker as well as the bare catalog id.
    const catalogId = findModel(id)?.id ?? id;

    // Prefer our explicit NIM models (correct id + baseUrl + compat)
    if (NVIDIA_MODELS[catalogId]) {
      const hard = { ...NVIDIA_MODELS[catalogId] };
      // Merge any richer built-in metadata if present, but never lose id/baseUrl
      const builtin = modelRuntime.getModel("nvidia", catalogId);
      if (builtin) {
        return {
          ...builtin,
          id: catalogId,
          provider: "nvidia",
          baseUrl: NVIDIA_BASE_URL,
          api: "openai-completions",
          headers: {
            ...(builtin.headers ?? {}),
            ...(hard.headers as Record<string, string>),
          },
          compat: { ...(builtin.compat ?? {}), ...NVIDIA_COMPAT },
        };
      }
      return hard;
    }

    const entry = findModel(catalogId);

    if (entry?.provider === "anthropic") {
      // pi ships the real Anthropic descriptors (cost, thinking levels, compat)
      // and composes auth from ~/.pi/agent/auth.json — an OAuth credential from
      // `pi auth` is picked up here without beide ever touching the token.
      // The literal below is only a fallback for a cold models-store.
      return (
        modelRuntime.getModel("anthropic", entry.id) ?? {
          id: entry.id,
          name: `${entry.name} ${entry.version}`,
          api: "anthropic-messages",
          provider: "anthropic",
          baseUrl: ANTHROPIC_BASE_URL,
          reasoning: true,
          input: ["text", "image"],
          cost: ZERO_COST,
          contextWindow: entry.contextWindow,
          maxTokens: entry.maxTokens,
        }
      );
    }

    if (entry?.provider === "google") {
      return (
        modelRuntime.getModel("google", entry.id) ?? {
          id: entry.id,
          name: `${entry.name} ${entry.version}`,
          api: "google-generative-ai",
          provider: "google",
          baseUrl: GOOGLE_BASE_URL,
          reasoning: false,
          input: entry.supportsImages ? ["text", "image"] : ["text"],
          cost: ZERO_COST,
          contextWindow: entry.contextWindow,
          maxTokens: entry.maxTokens,
        }
      );
    }

    if (entry?.provider === "xai") {
      return (
        modelRuntime.getModel("xai", entry.id) ??
        modelRuntime.getModel("xai", XAI_FALLBACK_MODEL)
      );
    }

    const available = await modelRuntime.getAvailable();
    const found = available.find(
      (m) => m.id === catalogId || `${m.provider}/${m.id}` === catalogId,
    );
    if (found?.provider === "nvidia") {
      return { ...found, baseUrl: NVIDIA_BASE_URL || found.baseUrl };
    }
    return found;
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

    // .env keys are no longer the only way in: a `pi auth login` (Anthropic
    // subscription, xAI) is a working credential too, so warn only when there
    // is no provider at all.
    const providers = await readProviderStatus();
    if (!providers.some((p) => p.connected)) {
      console.error(
        "[agent] no provider credentials — set BEIDE_GOOGLE_API_KEY / BEIDE_NVIDIA_API_KEY in .env or run `pi auth login`",
      );
      this.emit({
        type: "beide:warning",
        message:
          "Нет доступных провайдеров. Укажите ключи в .env (BEIDE_GOOGLE_API_KEY, BEIDE_NVIDIA_API_KEY) или войдите через `pi auth login` и перезапустите IDE.",
      });
    }

    if (!this.selectedModelId) {
      this.selectedModelId = PREFERRED_MODEL;
    }

    const requestedModelId = this.selectedModelId;
    let model = await this.resolveModel(modelRuntime, requestedModelId);

    if (!model) {
      console.warn(`[agent] model not found: ${requestedModelId}`);
      model =
        (await this.resolveModel(modelRuntime, PREFERRED_MODEL)) ??
        (await this.resolveModel(modelRuntime, "deepseek-ai/deepseek-v4-pro")) ??
        modelRuntime.getModel("xai", XAI_FALLBACK_MODEL);
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
      this.modelLabel =
        model.provider === "xai" ? `xai/${model.id}` : model.id;
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
          // NIM cold start can exceed default idle timeouts
          timeoutMs: 180_000,
          maxRetries: 2,
        },
      },
      httpIdleTimeoutMs: 300_000,
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
        // Plan mode: allow only a small readonly-ish whitelist. Anything else is blocked.
        if (this.mode === "plan") {
          const trimmed = command.trim();
          const firstToken = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
          // Map cmd.exe builtins to their target command
          const cmd = firstToken.replace(/\.exe$/i, "");
          // Package-manager binaries are deliberately absent: `npx <pkg>`,
          // `npm run`, `bun x` and `deno run` all execute arbitrary code, which
          // is exactly what plan mode exists to prevent. `awk` is out for the
          // same reason (system()/print > file).
          const READONLY_COMMANDS = new Set([
            "ls", "dir", "cat", "type", "head", "tail", "less", "more",
            "grep", "rg", "findstr", "find", "where", "which", "echo",
            "pwd", "cd", "pushd", "popd", "tree",
            "git",  // git itself is allowed; mutating subcommands blocked below
            "wc", "sort", "uniq", "cut",
          ]);
          // Subcommands that mutate — block even on otherwise-allowed binaries
          const MUTATING_SUBCOMMANDS = new Set([
            "install", "i", "add", "remove", "rm", "uninstall", "un",
            "publish", "run", "exec", "execute", "explore",
            "commit", "push", "pull", "merge", "rebase", "cherry-pick",
            "reset", "clean", "checkout", "switch", "branch",
            "write", "delete", "del", "format",
            "config", "tag", "stash", "notes",
          ]);
          const READONLY_GIT_SUBCOMMANDS = new Set([
            "status", "diff", "show", "log", "rev-parse", "ls-files",
            "ls-tree", "grep", "blame", "shortlog", "describe", "remote",
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
          if (cmd === "git" && !READONLY_GIT_SUBCOMMANDS.has(subcommand)) {
            const msg = Buffer.from(
              `Blocked in plan mode: git subcommand "${subcommand || "(missing)"}" is not readonly.\n`,
            );
            options.onData(msg);
            return { exitCode: 1 };
          }
          if (MUTATING_SUBCOMMANDS.has(subcommand)) {
            const msg = Buffer.from(
              `Blocked in plan mode: "${firstToken} ${subcommand}" looks mutating. Switch to Agent mode.\n`,
            );
            options.onData(msg);
            return { exitCode: 1 };
          }
          // Flags that make an otherwise-readonly binary write a file or run a
          // program: `sort -o out`, `tree -o out`, `uniq in out`,
          // `git log --output=f`, `git grep -O<pager>`, `rg --pre <cmd>`.
          if (
            (cmd === "sort" || cmd === "tree") &&
            /(^|\s)(-o\b|--output(=|\b)|\/o\b)/i.test(trimmed)
          ) {
            options.onData(
              Buffer.from(
                `Blocked in plan mode: "${cmd}" with an output flag writes a file. Switch to Agent mode.\n`,
              ),
            );
            return { exitCode: 1 };
          }
          if (cmd === "uniq" && /^\S+(?:\s+-\S+)*\s+[^-\s]\S*\s+[^-\s]\S*/.test(trimmed)) {
            options.onData(
              Buffer.from(
                "Blocked in plan mode: uniq with a second positional argument writes a file. Switch to Agent mode.\n",
              ),
            );
            return { exitCode: 1 };
          }
          if (cmd === "rg" && /(^|\s)(--pre\b|--hostname-bin\b)/.test(trimmed)) {
            options.onData(
              Buffer.from(
                "Blocked in plan mode: rg --pre executes a program. Switch to Agent mode.\n",
              ),
            );
            return { exitCode: 1 };
          }
          if (
            cmd === "git" &&
            /(^|\s)(--output(=|\b)|-O\S*|--open-files-in-pager(=|\b)|--exec-path(=|\b)|-c\b|--config-env(=|\b)|--upload-pack(=|\b)|--receive-pack(=|\b))/.test(
              trimmed,
            )
          ) {
            options.onData(
              Buffer.from(
                "Blocked in plan mode: git flag that writes a file or executes a program. Switch to Agent mode.\n",
              ),
            );
            return { exitCode: 1 };
          }
          // A whitelist for only the first token is bypassable with a second shell command.
          if (/[;&|\r\n]|`|\$\(/.test(command)) {
            const msg = Buffer.from(
              "Blocked in plan mode: command chaining is not allowed. Switch to Agent mode.\n",
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
          // Block pipes to shell interpreters — prevents command injection
          if (/\|\s*(sh|bash|zsh|pwsh|powershell|cmd|python|node|npx)\b/i.test(command)) {
            const msg = Buffer.from(
              "Blocked in plan mode: pipe to shell interpreter detected. Switch to Agent mode.\n",
            );
            options.onData(msg);
            return { exitCode: 1 };
          }
          // `find` is readonly only without its action flags.
          if (cmd === "find" && /(^|\s)-(exec|execdir|ok|okdir|delete)\b/.test(command)) {
            const msg = Buffer.from(
              "Blocked in plan mode: find action flags (-exec/-delete) mutate. Switch to Agent mode.\n",
            );
            options.onData(msg);
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
        return localBash.exec(command, bashCwd, {
          ...options,
          env: stripSecretEnv(options.env ?? process.env),
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
    ];
  }

  private async teardownSession(): Promise<void> {
    this.flushStreamBuffer();
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
 * The main process env carries provider credentials (loaded from .env). A child
 * shell the model can drive must not be able to echo them back, so anything
 * that looks like a credential is stripped before spawn.
 */
const SECRET_ENV_KEYS = new Set([
  "BEIDE_GOOGLE_API_KEY",
  "BEIDE_NVIDIA_API_KEY",
  "BEIDE_ADMIN_EMAIL",
  "BEIDE_ADMIN_PASSWORD",
  "GEMINI_API_KEY",
  "NVIDIA_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const SECRET_ENV_RE = /_API_KEY$|_KEY$|TOKEN|SECRET|PASSWORD|PASSWD/i;

function stripSecretEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
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
