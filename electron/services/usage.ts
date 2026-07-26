import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UsageStateData } from "../../src/lib/usage";
import {
  TOOL_TOKEN_COST,
  applySpend,
  cloneUsage,
  normalizeUsage,
} from "../../src/lib/usage";

export class UsageService {
  private cache: UsageStateData | null = null;
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath("userData"), "usage.json");
  }

  /**
   * Reads the file once, then serves from memory. Windows are re-rolled on
   * every call so a long-running app still resets at the 5h/weekly boundary;
   * disk is only touched when that roll (or the initial load) changes state.
   */
  async get(): Promise<UsageStateData> {
    if (!this.cache) {
      let raw: Partial<UsageStateData> | null = null;
      try {
        raw = JSON.parse(
          await readFile(this.filePath, "utf-8"),
        ) as Partial<UsageStateData>;
      } catch {
        raw = null;
      }
      this.cache = normalizeUsage(raw);
      await this.persist();
      return cloneUsage(this.cache);
    }

    const rolled = normalizeUsage(this.cache);
    const rolledOver =
      rolled.h5.key !== this.cache.h5.key || rolled.week.key !== this.cache.week.key;
    this.cache = rolled;
    if (rolledOver) await this.persist();
    return cloneUsage(this.cache);
  }

  /**
   * Increment usage by estimated tokens.
   * `prompts` is treated as "1 message event" → only used if tokens not provided.
   * Prefer explicit `tokens`.
   */
  async increment(delta: {
    prompts?: number;
    tools?: number;
    tokens?: number;
  }): Promise<UsageStateData> {
    const cur = await this.get();
    let cost = Math.max(0, Math.floor(delta.tokens ?? 0));
    if (cost <= 0 && (delta.prompts ?? 0) > 0) {
      // fallback: rough default if caller only passed prompts count
      cost = 800 * Math.max(0, delta.prompts ?? 0);
    }
    if ((delta.tools ?? 0) > 0) {
      cost += TOOL_TOKEN_COST * Math.max(0, delta.tools ?? 0);
    }
    if (cost <= 0) return cur;

    // Shared allocation rule — see `applySpend` in src/lib/usage.ts. It keeps
    // `limits`/`demo` on the snapshot; losing them would silently fall back to
    // the local `PLANS` mirror and show the wrong quota after a cloud sync.
    this.cache = applySpend(cur, cost).data;
    await this.persist();
    return cloneUsage(this.cache);
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    // tmp+rename: a torn write here silently resets the quota counters.
    const tmp = `${this.filePath}.tmp_${process.pid}`;
    await writeFile(tmp, JSON.stringify(this.cache, null, 2), "utf-8");
    await rename(tmp, this.filePath);
  }
}
