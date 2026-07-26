import { mkdir, readdir, readFile, rename as fsRename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CheckpointInfo } from "../../src/lib/types";
import { getCheckpointsDir, resolveRealInWorkspace, toWorkspaceRelative } from "./paths";

interface CheckpointMeta {
  id: string;
  createdAt: number;
  label: string;
  files: string[];
}

interface CheckpointEntryPayload {
  path: string;
  existed: boolean;
  content: string;
  encoding?: "utf-8" | "base64";
}

const ID_RE = /^[a-z0-9_-]+$/i;

function assertSafeId(id: string): void {
  if (!ID_RE.test(id)) {
    throw new Error(`Invalid checkpoint id: ${id}`);
  }
}

/**
 * Always index-based: a workspace file literally named `entry_0001.json` would
 * otherwise collide with the generated name of another entry. The real relative
 * path is carried inside the payload.
 */
function payloadName(index: number): string {
  return `entry_${index.toString().padStart(4, "0")}.json`;
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
    const checkpointsDir = this.dir();
    const stagingBase = join(checkpointsDir, `.staging_${id}`);
    const finalBase = join(checkpointsDir, id);

    await mkdir(stagingBase, { recursive: true });

    const saved: string[] = [];
    const unique = [...new Set(paths.filter(Boolean))];

    for (const [index, p] of unique.entries()) {
      let absolute: string;
      let rel: string;
      try {
        const looksAbsolute = /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/") || p.startsWith("\\");
        rel = looksAbsolute ? toWorkspaceRelative(root, p) : p.replace(/\\/g, "/");
        absolute = await resolveRealInWorkspace(root, rel);
      } catch {
        continue;
      }

      let buf: Buffer | null = null;
      try {
        buf = await readFile(absolute);
      } catch {
        buf = null; // new file
      }

      const safeName = payloadName(index);
      const copyPath = join(stagingBase, safeName);

      let content = "";
      let encoding: "utf-8" | "base64" = "utf-8";

      if (buf !== null) {
        const isBinary = buf.includes(0);
        if (isBinary) {
          content = buf.toString("base64");
          encoding = "base64";
        } else {
          content = buf.toString("utf-8");
          encoding = "utf-8";
        }
      }

      const payload: CheckpointEntryPayload = {
        path: rel,
        existed: buf !== null,
        content,
        encoding,
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
    await writeFile(join(stagingBase, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");

    try {
      await fsRename(stagingBase, finalBase);
    } catch {
      await mkdir(finalBase, { recursive: true });
      const entries = await readdir(stagingBase);
      for (const entry of entries) {
        const raw = await readFile(join(stagingBase, entry));
        await writeFile(join(finalBase, entry), raw);
      }
      await rm(stagingBase, { recursive: true, force: true });
    }

    void this.pruneOld(40);
    return id;
  }

  /** Keep only the newest N checkpoints to bound disk use. */
  private async pruneOld(keep = 40): Promise<void> {
    try {
      // Orphaned staging dirs left by a crash mid-snapshot/mid-restore. Their
      // names embed the creation timestamp; list() hides dot-dirs, so without
      // this they accumulated forever. An hour of grace keeps any live
      // concurrent snapshot/restore safe.
      const names = await readdir(this.dir());
      const cutoff = Date.now() - 3_600_000;
      for (const name of names) {
        const m = /^\.(?:staging|tmp_prerestore)_(\d+)/.exec(name);
        if (m && Number(m[1]) < cutoff) {
          await rm(join(this.dir(), name), { recursive: true, force: true });
        }
      }
      const list = await this.list();
      if (list.length <= keep) return;
      for (const cp of list.slice(keep)) {
        try {
          assertSafeId(cp.id);
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
      if (name.startsWith(".")) continue;
      try {
        assertSafeId(name);
        const raw = await readFile(join(base, name, "meta.json"), "utf-8");
        const meta = JSON.parse(raw) as CheckpointMeta;
        if (meta.id !== name) continue;
        out.push({
          id: name,
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

  private async restoreFromDir(dirPath: string): Promise<void> {
    const root = this.requireRoot();
    const entries = await readdir(dirPath);
    for (const entry of entries) {
      if (entry === "meta.json") continue;
      try {
        const payload = JSON.parse(
          await readFile(join(dirPath, entry), "utf-8"),
        ) as CheckpointEntryPayload;
        const absolute = await resolveRealInWorkspace(root, payload.path);
        if (!payload.existed) {
          await rm(absolute, { force: true });
        } else {
          await mkdir(dirname(absolute), { recursive: true });
          const data =
            payload.encoding === "base64"
              ? Buffer.from(payload.content, "base64")
              : payload.content;
          await writeFile(absolute, data);
        }
      } catch {
        // skip entry restore failure in helper
      }
    }
  }

  private async restoreImpl(id: string): Promise<void> {
    const root = this.requireRoot();
    assertSafeId(id);
    const base = join(this.dir(), id);
    const raw = await readFile(join(base, "meta.json"), "utf-8");
    const meta = JSON.parse(raw) as CheckpointMeta;

    const entries = await readdir(base);
    const targetPayloads: CheckpointEntryPayload[] = [];
    const targetPaths: string[] = [];

    for (const entry of entries) {
      if (entry === "meta.json") continue;
      try {
        const payload = JSON.parse(
          await readFile(join(base, entry), "utf-8"),
        ) as CheckpointEntryPayload;
        targetPayloads.push(payload);
        targetPaths.push(payload.path);
      } catch {
        /* ignore invalid entry */
      }
    }

    // Phase 1: Create Pre-Restore Staging Snapshot
    const tmpId = `.tmp_prerestore_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const tmpStagingDir = join(this.dir(), tmpId);
    await mkdir(tmpStagingDir, { recursive: true });

    for (const [index, rel] of targetPaths.entries()) {
      let absolute: string;
      try {
        absolute = await resolveRealInWorkspace(root, rel);
      } catch {
        continue;
      }
      let buf: Buffer | null = null;
      try {
        buf = await readFile(absolute);
      } catch {
        buf = null;
      }
      const safeName = payloadName(index);
      const copyPath = join(tmpStagingDir, safeName);
      let content = "";
      let encoding: "utf-8" | "base64" = "utf-8";
      if (buf !== null) {
        if (buf.includes(0)) {
          content = buf.toString("base64");
          encoding = "base64";
        } else {
          content = buf.toString("utf-8");
          encoding = "utf-8";
        }
      }
      const p: CheckpointEntryPayload = {
        path: rel,
        existed: buf !== null,
        content,
        encoding,
      };
      await writeFile(copyPath, JSON.stringify(p), "utf-8");
    }

    // Phase 2: Transactional Restore Execution
    try {
      for (const payload of targetPayloads) {
        const absolute = await resolveRealInWorkspace(root, payload.path);
        if (!payload.existed) {
          await rm(absolute, { force: true });
        } else {
          await mkdir(dirname(absolute), { recursive: true });
          const data =
            payload.encoding === "base64"
              ? Buffer.from(payload.content, "base64")
              : payload.content;
          await writeFile(absolute, data);
        }
      }
    } catch (restoreError) {
      // Automatic rollback on failure
      console.error(
        `[CheckpointService] Restore failed for checkpoint ${id}. Rolling back to pre-restore state.`,
        restoreError,
      );
      await this.restoreFromDir(tmpStagingDir);
      await rm(tmpStagingDir, { recursive: true, force: true });
      throw restoreError;
    }

    // Cleanup pre-restore staging snapshot after success
    await rm(tmpStagingDir, { recursive: true, force: true });

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
