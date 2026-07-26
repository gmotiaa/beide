import { app } from "electron";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { dirname, join } from "node:path";
import type { BeideSettings } from "../../src/lib/types";

export const DEFAULT_SETTINGS: BeideSettings = {
  language: "ru",
  theme: "light",
  permissionMode: "ask",
  telemetryEnabled: false,
  defaultAgentMode: "agent",
  modelLabel: "minimaxai/minimax-m3",
};

function sanitizeSettings(value: unknown): Partial<BeideSettings> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const out: Partial<BeideSettings> = {};
  if (input.language === "ru" || input.language === "en") out.language = input.language;
  if (input.theme === "dark" || input.theme === "light" || input.theme === "midnight") {
    out.theme = input.theme;
  }
  if (input.permissionMode === "ask" || input.permissionMode === "auto") {
    out.permissionMode = input.permissionMode;
  }
  if (typeof input.telemetryEnabled === "boolean") {
    out.telemetryEnabled = input.telemetryEnabled;
  }
  if (input.defaultAgentMode === "plan" || input.defaultAgentMode === "agent") {
    out.defaultAgentMode = input.defaultAgentMode;
  }
  if (typeof input.modelLabel === "string" && input.modelLabel.trim()) {
    out.modelLabel = input.modelLabel.trim().slice(0, 128);
  }
  return out;
}

export class SettingsService {
  private cache: BeideSettings | null = null;
  private readonly filePath: string;
  private watcher: FSWatcher | null = null;
  private mtime = 0;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath("userData"), "settings.json");
  }

  get path(): string {
    return this.filePath;
  }

  private async rememberMtime(): Promise<void> {
    try {
      this.mtime = (await stat(this.filePath)).mtimeMs;
    } catch {
      this.mtime = 0;
    }
  }

  async get(): Promise<BeideSettings> {
    // The watcher below clears the cache whenever the file changes underneath
    // us, so a warm cache is always current. `get()` runs on every prompt —
    // re-reading the file each time was pure I/O for no benefit.
    if (this.cache) return { ...this.cache };

    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = sanitizeSettings(JSON.parse(raw));
      this.cache = { ...DEFAULT_SETTINGS, ...parsed };
      await this.rememberMtime();
    } catch {
      this.cache = { ...DEFAULT_SETTINGS };
    }
    this.startWatch();
    return { ...this.cache };
  }

  async set(partial: Partial<BeideSettings>): Promise<BeideSettings> {
    const current = await this.get();
    const valid = sanitizeSettings(partial);
    const next: BeideSettings = {
      ...current,
      ...valid,
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    // tmp+rename: a crash mid-write must not leave settings.json half-written
    // (a corrupt file silently resets every preference to defaults).
    const tmp = `${this.filePath}.tmp_${process.pid}`;
    await writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
    await rename(tmp, this.filePath);
    this.cache = next;
    await this.rememberMtime();
    this.startWatch();
    return { ...next };
  }

  /** Called when the file watcher reports a change — invalidates the cache. */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Started lazily: on first run settings.json does not exist yet, and
   * `fs.watch` on a missing path throws — watching from the constructor meant
   * the watcher was never installed at all.
   */
  private startWatch(): void {
    if (this.watcher) return;
    try {
      this.watcher = watch(this.filePath, () => {
        // Avoid reacting to our own write: compare against the mtime we stored.
        stat(this.filePath)
          .then((s) => {
            if (s.mtimeMs !== this.mtime) this.invalidateCache();
          })
          .catch(() => this.invalidateCache());
      });
      this.watcher.on("error", () => {
        // fs watcher can fail on some platforms — fall back to no caching
        this.watcher = null;
        this.invalidateCache();
      });
    } catch {
      // file not created yet — retried on the next get()/set()
      this.watcher = null;
    }
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
