import { dialog, shell, type BrowserWindow } from "electron";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rename as fsRename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import type { FileNode } from "../../src/lib/types";
import {
  resolveInWorkspace,
  shouldSkipDir,
  SKIP_DIR_NAMES,
  toWorkspaceRelative,
} from "./paths";

export class WorkspaceService {
  private rootPath: string | null = null;
  private watcher: FSWatcher | null = null;
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  getRoot(): string | null {
    return this.rootPath;
  }

  async openFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Open Folder — beide",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const chosen = result.filePaths[0]!;
    await this.setRoot(chosen);
    return chosen;
  }

  async setRoot(path: string): Promise<void> {
    this.stopWatch();
    this.rootPath = path;
    this.startWatch(path);
  }

  async readDir(dirPath?: string): Promise<FileNode[]> {
    const root = this.requireRoot();
    const absolute = resolveInWorkspace(root, dirPath);
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: FileNode[] = [];
    for (const entry of entries) {
      if (entry.name === "." || entry.name === "..") continue;
      if (entry.isDirectory() && (SKIP_DIR_NAMES.has(entry.name) || shouldSkipDir(entry.name, dirPath || ""))) continue;

      const full = join(absolute, entry.name);
      const rel = toWorkspaceRelative(root, full);
      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: rel,
          type: "directory",
        });
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        nodes.push({
          name: entry.name,
          path: rel,
          type: "file",
        });
      }
    }

    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return nodes;
  }

  async readFile(filePath: string, maxBytes = 8_000_000): Promise<string> {
    const root = this.requireRoot();
    const absolute = resolveInWorkspace(root, filePath);
    const st = await stat(absolute);
    if (!st.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
    if (st.size > maxBytes) {
      throw new Error(
        `File too large to read (${st.size} bytes, max ${maxBytes}): ${filePath}`,
      );
    }
    const buf = await readFile(absolute);
    // Reject obvious binary
    if (buf.includes(0)) {
      throw new Error(`Binary file cannot be read as text: ${filePath}`);
    }
    return buf.toString("utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const root = this.requireRoot();
    if (typeof content !== "string") {
      throw new Error("content must be a string");
    }
    if (content.length > 8_000_000) {
      throw new Error("content too large (max 8MB)");
    }
    const absolute = resolveInWorkspace(root, filePath);
    await mkdir(dirname(absolute), { recursive: true });
    // Atomic-ish write: temp then replace (Windows-safe)
    const tmp = `${absolute}.beide-tmp-${process.pid}-${Date.now()}`;
    try {
      await writeFile(tmp, content, "utf-8");
      try {
        await fsRename(tmp, absolute);
      } catch {
        // On Windows rename fails if dest exists — overwrite then drop temp
        await writeFile(absolute, content, "utf-8");
        await rm(tmp, { force: true });
      }
    } catch (e) {
      try {
        await rm(tmp, { force: true });
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  async pathExists(filePath: string): Promise<boolean> {
    const root = this.rootPath;
    if (!root) return false;
    try {
      const absolute = resolveInWorkspace(root, filePath);
      await access(absolute);
      return true;
    } catch {
      return false;
    }
  }

  /** Delete file or directory (recursive) inside workspace. */
  async deletePath(targetPath: string): Promise<void> {
    const root = this.requireRoot();
    const absolute = resolveInWorkspace(root, targetPath);
    // Never delete workspace root itself
    if (absolute === root || absolute === root + sep) {
      throw new Error("Cannot delete workspace root");
    }
    await rm(absolute, { recursive: true, force: true });
    this.notifyChanged(targetPath);
  }

  /** Rename / move within workspace. newName can be basename or relative path. */
  async renamePath(targetPath: string, newName: string): Promise<string> {
    const root = this.requireRoot();
    const absolute = resolveInWorkspace(root, targetPath);
    const clean = newName.trim().replace(/[/\\]+/g, sep);
    if (!clean || clean === "." || clean === "..") {
      throw new Error("Invalid name");
    }
    const destAbs = clean.includes(sep)
      ? resolveInWorkspace(root, clean)
      : join(dirname(absolute), clean);
    // stay inside workspace
    resolveInWorkspace(root, relative(root, destAbs) || ".");
    await mkdir(dirname(destAbs), { recursive: true });
    await fsRename(absolute, destAbs);
    const newRel = toWorkspaceRelative(root, destAbs);
    this.notifyChanged(targetPath);
    this.notifyChanged(newRel);
    return newRel;
  }

  async revealInFolder(targetPath: string): Promise<void> {
    const root = this.requireRoot();
    const absolute = resolveInWorkspace(root, targetPath);
    shell.showItemInFolder(absolute);
  }

  private notifyChanged(relPath: string): void {
    this.mainWindow?.webContents.send("workspace:changed", {
      path: relPath.replace(/\\/g, "/"),
    });
  }

  async searchFiles(query: string): Promise<string[]> {
    const root = this.requireRoot();
    const q = query.trim().toLowerCase();
    if (!q || q.length > 200) return [];

    const results: string[] = [];
    const limit = 200;
    let visited = 0;
    const maxVisit = 8_000;

    const walk = async (dir: string, relParent: string, depth: number): Promise<void> => {
      if (results.length >= limit || visited >= maxVisit || depth > 12) return;
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= limit || visited >= maxVisit) return;
        visited += 1;
        if (entry.name === "." || entry.name === "..") continue;
        if (entry.isDirectory() && shouldSkipDir(entry.name, relParent)) continue;

        const full = join(dir, entry.name);
        const rel = relParent ? `${relParent}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await walk(full, rel, depth + 1);
        } else if (entry.isFile()) {
          const nameL = entry.name.toLowerCase();
          const relL = rel.toLowerCase();
          if (nameL.includes(q) || relL.includes(q)) {
            results.push(rel.replace(/\\/g, "/"));
          }
        }
      }
    };

    await walk(root, "", 0);
    return results;
  }

  /** Read absolute path only if under workspace (for agent helpers). */
  async readAbsolute(absolutePath: string): Promise<string> {
    const root = this.requireRoot();
    resolveInWorkspace(root, relative(root, absolutePath) || ".");
    return readFile(absolutePath, "utf-8");
  }

  private requireRoot(): string {
    if (!this.rootPath) {
      throw new Error("No workspace open");
    }
    return this.rootPath;
  }

  private startWatch(root: string): void {
    try {
      this.watcher = watch(root, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const name = filename.toString();
        // Ignore noisy paths
        const parts = name.split(/[/\\]/);
        if (parts.some((p) => SKIP_DIR_NAMES.has(p))) return;
        if (parts.includes("checkpoints")) return;

        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => {
          this.mainWindow?.webContents.send("workspace:changed", {
            path: name.replace(/\\/g, "/"),
          });
        }, 120);
      });
      this.watcher.on("error", () => {
        // Recursive watch can fail on some FS; ignore
      });
    } catch {
      // Windows / network FS may not support recursive watch
    }
  }

  private stopWatch(): void {
    if (this.watchTimer) {
      clearTimeout(this.watchTimer);
      this.watchTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  dispose(): void {
    this.stopWatch();
    this.rootPath = null;
  }
}

/** Utility used by checkpoints to copy single files. */
export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(join(filePath, ".."), { recursive: true });
}

export async function fileStatSafe(path: string): Promise<{ isFile: boolean; size: number } | null> {
  try {
    const s = await stat(path);
    return { isFile: s.isFile(), size: s.size };
  } catch {
    return null;
  }
}

export function fileBasename(path: string): string {
  return basename(path);
}

export function joinPath(...parts: string[]): string {
  return join(...parts);
}

export function splitPath(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean);
}

export function pathSep(): string {
  return sep;
}
