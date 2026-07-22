import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UsagePlanId, UsageStateData } from "../../src/lib/usage";
import {
  PLANS,
  TOOL_TOKEN_COST,
  emptyUsage,
  normalizeUsage,
} from "../../src/lib/usage";

export class UsageService {
  private cache: UsageStateData | null = null;
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(app.getPath("userData"), "usage.json");
  }

  async get(): Promise<UsageStateData> {
    try {
      const raw = JSON.parse(
        await readFile(this.filePath, "utf-8"),
      ) as Partial<UsageStateData>;
      this.cache = normalizeUsage(raw);
    } catch {
      this.cache = normalizeUsage(null);
    }
    await this.persist();
    return clone(this.cache);
  }

  async setPlan(plan: UsagePlanId): Promise<UsageStateData> {
    const cur = await this.get();
    const nextPlan = plan === "pro" ? "pro" : "free";
    this.cache = {
      ...cur,
      plan: nextPlan,
      credits: cur.credits > 0 ? cur.credits : PLANS[nextPlan].credits,
    };
    await this.persist();
    return this.get();
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
    if (cost <= 0) return this.get();

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
    return this.get();
  }

  async resetToday(): Promise<UsageStateData> {
    const cur = await this.get();
    this.cache = emptyUsage(cur.plan);
    this.cache.credits = cur.credits;
    await this.persist();
    return this.get();
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify(this.cache, null, 2),
      "utf-8",
    );
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
