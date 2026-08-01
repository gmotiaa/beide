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
import { dirname, join, relative, resolve, sep } from "node:path";
import type { FileNode } from "../../src/lib/types";
import {
  GitIgnoreMatcher,
  resolveInWorkspace,
  resolveRealInWorkspace,
  shouldSkipDir,
  SKIP_DIR_NAMES,
  toWorkspaceRelative,
} from "./paths";

const CACHE_TTL_MS = 5_000;

export class WorkspaceService {
  private rootPath: string | null = null;
  private watcher: FSWatcher | null = null;
  private watchTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingWatchPaths = new Set<string>();
  private mainWindow: BrowserWindow | null = null;
  private gitIgnoreMatcher: GitIgnoreMatcher | null = null;
  private dirCache = new Map<string, { nodes: FileNode[]; timestamp: number }>();

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  getRoot(): string | null {
    return this.rootPath;
  }

  /** Pick a directory without changing any process state. The renderer first
   * flushes the outgoing chat and resolves dirty editor buffers, then commits
   * the selection through setRoot(). */
  async pickFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Open Folder — beide",
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0]!;
  }

  async setRoot(path: string): Promise<string> {
    const absolute = resolve(path);
    const info = await stat(absolute);
    if (!info.isDirectory()) {
      throw new Error(`Not a directory: ${path}`);
    }
    this.stopWatch();
    this.dirCache.clear();
    this.pendingWatchPaths.clear();
    this.rootPath = absolute;
    await this.loadGitIgnore(absolute);
    this.startWatch(absolute);
    return absolute;
  }

  private async loadGitIgnore(root: string): Promise<void> {
    const matcher = new GitIgnoreMatcher();
    const candidates = [join(root, ".gitignore"), join(root, ".beideignore")];
    for (const file of candidates) {
      try {
        const content = await readFile(file, "utf-8");
        matcher.addPatterns(content);
      } catch {
        /* missing file is ok */
      }
    }
    this.gitIgnoreMatcher = matcher;
  }

  clearCache(): void {
    this.dirCache.clear();
  }

  async readDir(dirPath?: string): Promise<FileNode[]> {
    const root = this.requireRoot();
    const cacheKey = (dirPath || "").replace(/\\/g, "/");
    const cached = this.dirCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return cached.nodes;
    }

    const absolute = await resolveRealInWorkspace(root, dirPath);
    let entries;
    try {
      entries = await readdir(absolute, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: FileNode[] = [];
    for (const entry of entries) {
      if (entry.name === "." || entry.name === "..") continue;

      const relParent = dirPath ? dirPath.replace(/\\/g, "/") : "";
      const relPath = relParent ? `${relParent}/${entry.name}` : entry.name;
      const isDir = entry.isDirectory();

      // Directory skip lists must not hide files that happen to share a name
      // with a heavy directory (e.g. a file literally called `out` or `dist`).
      if (isDir && shouldSkipDir(entry.name, relParent, this.gitIgnoreMatcher)) {
        continue;
      }
      if (this.gitIgnoreMatcher?.ignores(relPath, isDir)) {
        continue;
      }

      const full = join(absolute, entry.name);
      const rel = toWorkspaceRelative(root, full);
      if (isDir) {
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

    this.dirCache.set(cacheKey, { nodes, timestamp: now });
    return nodes;
  }

  async readFile(filePath: string, maxBytes = 8_000_000): Promise<string> {
    const root = this.requireRoot();
    const absolute = await resolveRealInWorkspace(root, filePath);
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
    const absolute = await resolveRealInWorkspace(root, filePath);
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
    this.dirCache.clear();
  }

  async pathExists(filePath: string): Promise<boolean> {
    const root = this.rootPath;
    if (!root) return false;
    try {
      const absolute = await resolveRealInWorkspace(root, filePath);
      await access(absolute);
      return true;
    } catch {
      return false;
    }
  }

  /** Delete file or directory (recursive) inside workspace. */
  async deletePath(targetPath: string): Promise<void> {
    const root = this.requireRoot();
    const absolute = await resolveRealInWorkspace(root, targetPath);
    // Never delete workspace root itself. Windows paths are case-insensitive,
    // so `../IDE` resolves to the root while comparing unequal to `…\ide` —
    // an exact compare let that rm -rf the whole workspace.
    const cmp = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);
    if (cmp(absolute) === cmp(root) || cmp(absolute) === cmp(root + sep)) {
      throw new Error("Cannot delete workspace root");
    }
    await rm(absolute, { recursive: true, force: true });
    this.dirCache.clear();
    this.notifyChanged(targetPath);
  }

  /** Rename / move within workspace. newName can be basename or relative path. */
  async renamePath(targetPath: string, newName: string): Promise<string> {
    const root = this.requireRoot();
    const absolute = await resolveRealInWorkspace(root, targetPath);
    const clean = newName.trim().replace(/[/\\]+/g, sep);
    if (!clean || clean === "." || clean === "..") {
      throw new Error("Invalid name");
    }
    const destAbs = clean.includes(sep)
      ? resolveInWorkspace(root, clean)
      : join(dirname(absolute), clean);
    // stay inside workspace
    await resolveRealInWorkspace(root, relative(root, destAbs) || ".");
    // fsRename silently overwrites the destination — a rename onto an existing
    // file would destroy it with no checkpoint to recover from.
    const sameAsSource =
      process.platform === "win32"
        ? destAbs.toLowerCase() === absolute.toLowerCase()
        : destAbs === absolute;
    if (!sameAsSource) {
      let destExists = true;
      try {
        await access(destAbs);
      } catch {
        destExists = false;
      }
      if (destExists) {
        throw new Error(`Already exists: ${toWorkspaceRelative(root, destAbs)}`);
      }
    }
    await mkdir(dirname(destAbs), { recursive: true });
    await fsRename(absolute, destAbs);
    const newRel = toWorkspaceRelative(root, destAbs);
    this.dirCache.clear();
    this.notifyChanged(targetPath);
    this.notifyChanged(newRel);
    return newRel;
  }

  async revealInFolder(targetPath: string): Promise<void> {
    const root = this.requireRoot();
    const absolute = await resolveRealInWorkspace(root, targetPath);
    shell.showItemInFolder(absolute);
  }

  /** `webContents.send` throws once the window is destroyed — always go via here. */
  private post(payload: unknown): void {
    const win = this.mainWindow;
    if (!win || win.isDestroyed()) return;
    try {
      win.webContents.send("workspace:changed", payload);
    } catch {
      // renderer torn down between the check and the send
    }
  }

  private notifyChanged(relPath: string): void {
    this.post({ path: relPath.replace(/\\/g, "/") });
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

        const rel = relParent ? `${relParent}/${entry.name}` : entry.name;
        const isDir = entry.isDirectory();

        if (isDir && shouldSkipDir(entry.name, relParent, this.gitIgnoreMatcher)) {
          continue;
        }
        if (this.gitIgnoreMatcher?.ignores(rel, isDir)) {
          continue;
        }

        const full = join(dir, entry.name);

        if (isDir) {
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

  /**
   * Literal, case-insensitive content search across text files. Powers the
   * @codebase mention: JS-side scan (no ripgrep dependency on Windows),
   * bounded hard so a huge repo cannot stall the main process.
   */
  async searchContent(
    query: string,
  ): Promise<Array<{ path: string; line: number; text: string }>> {
    const root = this.requireRoot();
    const q = query.trim().toLowerCase();
    if (q.length < 2 || q.length > 200) return [];

    const results: Array<{ path: string; line: number; text: string }> = [];
    const limit = 120;
    let visited = 0;
    const maxVisit = 6_000;
    const maxFileBytes = 512_000;
    const textExt =
      /\.(ts|tsx|js|jsx|mjs|cjs|json|jsonc|css|scss|html|md|mdx|txt|yml|yaml|toml|py|go|rs|java|kt|c|h|cpp|hpp|cs|rb|php|sql|sh|ps1|vue|svelte)$/i;

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
        const rel = relParent ? `${relParent}/${entry.name}` : entry.name;
        const isDir = entry.isDirectory();
        if (isDir && shouldSkipDir(entry.name, relParent, this.gitIgnoreMatcher)) continue;
        if (this.gitIgnoreMatcher?.ignores(rel, isDir)) continue;
        const full = join(dir, entry.name);
        if (isDir) {
          await walk(full, rel, depth + 1);
          continue;
        }
        if (!entry.isFile() || !textExt.test(entry.name)) continue;
        try {
          if ((await stat(full)).size > maxFileBytes) continue;
          const lines = (await readFile(full, "utf-8")).split(/\r?\n/);
          for (let i = 0; i < lines.length && results.length < limit; i++) {
            if (lines[i]!.toLowerCase().includes(q)) {
              results.push({
                path: rel.replace(/\\/g, "/"),
                line: i + 1,
                text: lines[i]!.trim().slice(0, 240),
              });
            }
          }
        } catch {
          // unreadable file — skip
        }
      }
    };

    await walk(root, "", 0);
    return results;
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

        const relPath = name.replace(/\\/g, "/");
        if (this.gitIgnoreMatcher?.ignores(relPath)) return;

        this.pendingWatchPaths.add(relPath);

        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(async () => {
          this.dirCache.clear();
          const paths = Array.from(this.pendingWatchPaths);
          this.pendingWatchPaths.clear();
          if (paths.length === 0) return;

          if (
            paths.some(
              (p) =>
                p === ".gitignore" ||
                p === ".beideignore" ||
                p.endsWith("/.gitignore") ||
                p.endsWith("/.beideignore"),
            )
          ) {
            await this.loadGitIgnore(root);
          }

          this.post({ path: paths[0], paths });
        }, 150);
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
    this.dirCache.clear();
    this.pendingWatchPaths.clear();
    this.rootPath = null;
  }
}
