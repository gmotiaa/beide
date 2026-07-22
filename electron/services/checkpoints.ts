import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CheckpointInfo } from "../../src/lib/types";
import { getCheckpointsDir, resolveInWorkspace, toWorkspaceRelative } from "./paths";

interface CheckpointMeta {
  id: string;
  createdAt: number;
  label: string;
  files: string[];
}

const ID_RE = /^[a-z0-9_-]+$/i;

function assertSafeId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new Error(`Invalid checkpoint id: ${id}`);
  }
}

export class CheckpointService {
  private workspaceRoot: string | null = null;
  private restoreChain: Promise<void> = Promise.resolve();

  setWorkspace(root: string | null): void {
    this.workspaceRoot = root;
  }

  private requireRoot(): string {
    if (!this.workspaceRoot) throw new Error("No workspace open");
    return this.workspaceRoot;
  }

  private dir(): string {
    return getCheckpointsDir(this.requireRoot());
  }

  /**
   * Snapshot current contents of the given workspace-relative or absolute paths
   * before a mutation. Returns checkpoint id.
   */
  async snapshot(paths: string[], label = "agent edit"): Promise<string> {
    const root = this.requireRoot();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const base = join(this.dir(), id);
    await mkdir(base, { recursive: true });

    const saved: string[] = [];
    const unique = [...new Set(paths.filter(Boolean))];

    for (const p of unique) {
      let absolute: string;
      let rel: string;
      try {
        // Accept workspace-relative or absolute-under-workspace paths
        const looksAbsolute = /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/") || p.startsWith("\\");
        rel = looksAbsolute ? toWorkspaceRelative(root, p) : p.replace(/\\/g, "/");
        absolute = resolveInWorkspace(root, rel);
      } catch {
        continue;
      }

      let content: string | null = null;
      try {
        content = await readFile(absolute, "utf-8");
      } catch {
        content = null; // new file
      }

      const safeName = rel.replace(/[\\/]/g, "__");
      const copyPath = join(base, safeName);
      const payload = {
        path: rel,
        existed: content !== null,
        content: content ?? "",
      };
      await writeFile(copyPath, JSON.stringify(payload), "utf-8");
      saved.push(rel);
    }

    const meta: CheckpointMeta = {
      id,
      createdAt: Date.now(),
      label,
      files: saved,
    };
    await writeFile(join(base, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
    void this.pruneOld(40);
    return id;
  }

  /** Keep only the newest N checkpoints to bound disk use. */
  private async pruneOld(keep = 40): Promise<void> {
    try {
      const list = await this.list();
      if (list.length <= keep) return;
      for (const cp of list.slice(keep)) {
        try {
          await rm(join(this.dir(), cp.id), { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  async list(): Promise<CheckpointInfo[]> {
    if (!this.workspaceRoot) return [];
    const base = this.dir();
    let names: string[];
    try {
      names = await readdir(base);
    } catch {
      return [];
    }

    const out: CheckpointInfo[] = [];
    for (const name of names) {
      try {
        const raw = await readFile(join(base, name, "meta.json"), "utf-8");
        const meta = JSON.parse(raw) as CheckpointMeta;
        out.push({
          id: meta.id,
          createdAt: meta.createdAt,
          label: meta.label,
          files: meta.files ?? [],
        });
      } catch {
        // skip corrupt
      }
    }
    out.sort((a, b) => b.createdAt - a.createdAt);
    return out;
  }

  async restore(id: string): Promise<void> {
    // Serialize restores — prevent TOCTOU when several run in parallel.
    const run = () => this.restoreImpl(id);
    this.restoreChain = this.restoreChain.then(run, run);
    return this.restoreChain;
  }

  private async restoreImpl(id: string): Promise<void> {
    const root = this.requireRoot();
    assertSafeId(id);
    const base = join(this.dir(), id);
    const raw = await readFile(join(base, "meta.json"), "utf-8");
    const meta = JSON.parse(raw) as CheckpointMeta;

    const entries = await readdir(base);
    for (const entry of entries) {
      if (entry === "meta.json") continue;
      try {
        const payload = JSON.parse(await readFile(join(base, entry), "utf-8")) as {
          path: string;
          existed: boolean;
          content: string;
        };
        const absolute = resolveInWorkspace(root, payload.path);
        if (!payload.existed) {
          await rm(absolute, { force: true });
        } else {
          await mkdir(dirname(absolute), { recursive: true });
          await writeFile(absolute, payload.content, "utf-8");
        }
      } catch {
        // skip
      }
    }

    // Touch meta for consumers
    void meta;
  }
}

/** Simple unified-ish diff for permission UI. */
export function simpleDiff(path: string, before: string, after: string): string {
  const lines: string[] = [`--- a/${path}`, `+++ b/${path}`];

  // Guard against binary / huge content — don't produce a noisy diff
  const looksBinary =
    /[\x00-\x08\x0E-\x1F]/.test(before) || /[\x00-\x08\x0E-\x1F]/.test(after);
  if (looksBinary) {
    lines.push(`@@ binary @@`);
    lines.push(`- ${before.length} bytes`);
    lines.push(`+ ${after.length} bytes`);
    return lines.join("\n");
  }

  // Prefer line-oriented hunk when sizes are manageable
  if (before === after) {
    lines.push("@@ no changes @@");
    return lines.join("\n");
  }

  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);

  if (max > 2000) {
    lines.push(`@@ -1,${beforeLines.length} +1,${afterLines.length} @@`);
    lines.push(`- (${beforeLines.length} lines)`);
    lines.push(`+ (${afterLines.length} lines)`);
    return lines.join("\n");
  }

  // Myers-lite: walk with LCS-free equal prefix/suffix strip
  let start = 0;
  while (
    start < beforeLines.length &&
    start < afterLines.length &&
    beforeLines[start] === afterLines[start]
  ) {
    start++;
  }
  let endOld = beforeLines.length - 1;
  let endNew = afterLines.length - 1;
  while (
    endOld >= start &&
    endNew >= start &&
    beforeLines[endOld] === afterLines[endNew]
  ) {
    endOld--;
    endNew--;
  }

  const oldCount = Math.max(0, endOld - start + 1);
  const newCount = Math.max(0, endNew - start + 1);
  lines.push(`@@ -${start + 1},${oldCount} +${start + 1},${newCount} @@`);

  for (let i = start; i <= endOld; i++) {
    lines.push(`-${beforeLines[i]}`);
  }
  for (let i = start; i <= endNew; i++) {
    lines.push(`+${afterLines[i]}`);
  }
  return lines.join("\n");
}
