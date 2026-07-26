import { app } from "electron";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UsageStateData } from "../../src/lib/usage";
import { PLANS, TOOL_TOKEN_COST, normalizeUsage } from "../../src/lib/usage";

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
      return clone(this.cache);
    }

    const rolled = normalizeUsage(this.cache);
    const rolledOver =
      rolled.h5.key !== this.cache.h5.key || rolled.week.key !== this.cache.week.key;
    this.cache = rolled;
    if (rolledOver) await this.persist();
    return clone(this.cache);
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

    const limits = PLANS[cur.plan];
    let h5 = cur.h5.used;
    let week = cur.week.used;
    let credits = cur.credits;

    let remaining = cost;
    // Spend from plan windows first (shared min headroom)
    const planRoom = Math.max(
      0,
      Math.min(limits.tokens5h - h5, limits.tokensWeek - week),
    );
    const fromPlan = Math.min(planRoom, remaining);
    h5 += fromPlan;
    week += fromPlan;
    remaining -= fromPlan;

    if (remaining > 0) {
      const fromCredits = Math.min(credits, remaining);
      credits -= fromCredits;
      remaining -= fromCredits;
    }

    // If still over (should be blocked client-side), record overshoot on windows
    if (remaining > 0) {
      h5 += remaining;
      week += remaining;
    }

    this.cache = {
      plan: cur.plan,
      h5: { ...cur.h5, used: h5 },
      week: { ...cur.week, used: week },
      credits,
    };
    await this.persist();
    return clone(this.cache);
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

function clone(d: UsageStateData): UsageStateData {
  return {
    plan: d.plan,
    h5: { ...d.h5 },
    week: { ...d.week },
    credits: d.credits,
  };
}
