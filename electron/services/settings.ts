import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { dirname, join } from "node:path";
import type { BeideSettings } from "../../src/lib/types";

export const DEFAULT_SETTINGS: BeideSettings = {
  language: "ru",
  theme: "light",
  permissionMode: "ask",
  telemetryEnabled: false,
  defaultAgentMode: "agent",
  modelLabel: "grok-4.5",
};

export class SettingsService {
  private cache: BeideSettings | null = null;
  private readonly filePath: string;
  private watcher: FSWatcher | null = null;
  private mtime = 0;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath("userData"), "settings.json");
    this.startWatch();
  }

  get path(): string {
    return this.filePath;
  }

  async get(): Promise<BeideSettings> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<BeideSettings>;
      this.cache = { ...DEFAULT_SETTINGS, ...parsed };
      try {
        const stat = await (await import("node:fs/promises")).stat(this.filePath);
        this.mtime = stat.mtimeMs;
      } catch {
        /* ignore */
      }
    } catch {
      this.cache = { ...DEFAULT_SETTINGS };
    }
    return { ...this.cache };
  }

  async set(partial: Partial<BeideSettings>): Promise<BeideSettings> {
    const current = await this.get();
    const next: BeideSettings = {
      ...current,
      ...partial,
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(next, null, 2), "utf-8");
    this.cache = next;
    try {
      const stat = await (await import("node:fs/promises")).stat(this.filePath);
      this.mtime = stat.mtimeMs;
    } catch {
      /* ignore */
    }
    return { ...next };
  }

  /** Called when the file watcher reports a change — invalidates the cache. */
  invalidateCache(): void {
    this.cache = null;
  }

  private startWatch(): void {
    try {
      this.watcher = watch(this.filePath, () => {
        // Avoid clobbering an in-flight write: stat and compare mtime.
        import("node:fs/promises")
          .then(({ stat }) => stat(this.filePath))
          .then((s) => {
            if (s.mtimeMs !== this.mtime) {
              this.invalidateCache();
            }
          })
          .catch(() => undefined);
      });
      this.watcher.on("error", () => {
        // fs watcher can fail on some platforms; cache just stays stale
      });
    } catch {
      // directory may not exist yet — ignore
    }
  }

  dispose(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
