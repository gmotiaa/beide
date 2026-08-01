import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";

/** Global pi agent directory (~/.pi/agent). */
export function getPiAgentDir(): string {
  return join(homedir(), ".pi", "agent");
}

/** Workspace-local beide metadata root. */
function getBeideRoot(workspaceRoot: string): string {
  return join(workspaceRoot, ".beide");
}

export function getCheckpointsDir(workspaceRoot: string): string {
  return join(getBeideRoot(workspaceRoot), "checkpoints");
}

export function getSessionsDir(workspaceRoot: string): string {
  return join(getBeideRoot(workspaceRoot), "sessions");
}

export function getRulesCandidates(workspaceRoot: string): string[] {
  return [join(workspaceRoot, "BEIDE.md"), join(getBeideRoot(workspaceRoot), "rules.md")];
}

/**
 * Resolve a path relative to workspace root and ensure it stays inside the root.
 * Absolute paths outside the workspace throw.
 * Also normalizes `..` segments and rejects null bytes / weird prefixes.
 */
export function resolveInWorkspace(workspaceRoot: string, targetPath?: string): string {
  const root = resolve(workspaceRoot);
  if (!targetPath || targetPath === "." || targetPath === "") {
    return root;
  }
  if (typeof targetPath !== "string") {
    throw new Error("Path must be a string");
  }
  if (targetPath.includes("\0")) {
    throw new Error("Path contains null byte");
  }
  const absolute = resolve(root, targetPath);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  // Case-insensitive compare on Windows
  const absCmp =
    process.platform === "win32" ? absolute.toLowerCase() : absolute;
  const rootCmp = process.platform === "win32" ? root.toLowerCase() : root;
  const rootSepCmp =
    process.platform === "win32" ? rootWithSep.toLowerCase() : rootWithSep;
  if (absCmp !== rootCmp && !absCmp.startsWith(rootSepCmp)) {
    throw new Error(`Path escapes workspace: ${targetPath}`);
  }
  return absolute;
}

/**
 * Same containment guarantee as `resolveInWorkspace`, but symlink-aware.
 * The lexical check alone is satisfied by a symlink (or Windows junction) that
 * lives inside the workspace and points outside it, so reads/writes through it
 * escape the sandbox. Resolve real paths and re-check before touching disk.
 */
export async function resolveRealInWorkspace(
  workspaceRoot: string,
  targetPath?: string,
): Promise<string> {
  const absolute = resolveInWorkspace(workspaceRoot, targetPath);
  const realRoot = await realpath(resolve(workspaceRoot));

  // The target may not exist yet (new file): walk up to the deepest existing
  // ancestor, resolve that, then re-attach the missing tail.
  const missingTail: string[] = [];
  let probe = absolute;
  let realExisting: string | null = null;
  for (;;) {
    try {
      realExisting = await realpath(probe);
      break;
    } catch {
      const parent = dirname(probe);
      if (parent === probe) break;
      missingTail.unshift(basename(probe));
      probe = parent;
    }
  }
  if (realExisting === null) {
    throw new Error(`Path escapes workspace: ${targetPath ?? ""}`);
  }
  const real = missingTail.length ? join(realExisting, ...missingTail) : realExisting;

  const isWin = process.platform === "win32";
  const rootWithSep = realRoot.endsWith(sep) ? realRoot : realRoot + sep;
  const realCmp = isWin ? real.toLowerCase() : real;
  const rootCmp = isWin ? realRoot.toLowerCase() : realRoot;
  const rootSepCmp = isWin ? rootWithSep.toLowerCase() : rootWithSep;
  if (realCmp !== rootCmp && !realCmp.startsWith(rootSepCmp)) {
    throw new Error(`Path escapes workspace: ${targetPath ?? ""}`);
  }
  return absolute;
}

/** Relative path from workspace root using forward slashes for UI. */
export function toWorkspaceRelative(workspaceRoot: string, absolutePath: string): string {
  const root = resolve(workspaceRoot);
  const abs = resolve(absolutePath);
  const isWin = process.platform === "win32";
  const absCmp = isWin ? abs.toLowerCase() : abs;
  const rootCmp = isWin ? root.toLowerCase() : root;
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  const rootSepCmp = isWin ? rootWithSep.toLowerCase() : rootWithSep;
  if (absCmp !== rootCmp && !absCmp.startsWith(rootSepCmp)) {
    return normalize(abs).replace(/\\/g, "/");
  }
  // Slice from the original abs (not lowercased) to preserve original casing
  return abs.slice(rootWithSep.length).replace(/\\/g, "/");
}

/** Directory names skipped when walking the tree (still allow listing `.beide` itself). */
export const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  ".next",
  "coverage",
  "__pycache__",
  ".turbo",
  ".cache",
]);

export class GitIgnoreMatcher {
  private rules: Array<{ negated: boolean; dirOnly: boolean; regex: RegExp }> = [];

  addPatterns(content: string): void {
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      let negated = false;
      let pattern = line;
      if (pattern.startsWith("!")) {
        negated = true;
        pattern = pattern.slice(1).trim();
      }

      let dirOnly = false;
      if (pattern.endsWith("/")) {
        dirOnly = true;
        pattern = pattern.slice(0, -1).trim();
      }

      if (!pattern) continue;

      let anchored = false;
      if (pattern.startsWith("/")) {
        anchored = true;
        pattern = pattern.slice(1);
      } else if (pattern.includes("/")) {
        anchored = true;
      }

      // `*` and `?` must be escaped here too: the translations below look for
      // the *escaped* forms (\* and \?). Leaving them bare made `**` compile to
      // an invalid quantifier (silently dropping the rule) and made every
      // single-`*` pattern match by accident or not at all.
      let regexStr = pattern
        .replace(/[.+^${}()|[\]\\*?]/g, "\\$&")
        .replace(/\\\*\\\*\//g, "(?:.*/)?") // `**/x` — any depth, including none
        .replace(/\/\\\*\\\*/g, "/.*") // `x/**` — everything below x
        .replace(/\\\*\\\*/g, ".*")
        .replace(/\\\*/g, "[^/]*")
        .replace(/\\\?/g, "[^/]");

      if (anchored) {
        regexStr = "^" + regexStr + "($|/)";
      } else {
        regexStr = "(^|/)" + regexStr + "($|/)";
      }

      try {
        this.rules.push({ negated, dirOnly, regex: new RegExp(regexStr) });
      } catch {
        // ignore invalid regex
      }
    }
  }

  ignores(relPath: string, isDirectory?: boolean): boolean {
    const clean = relPath.replace(/\\/g, "/").replace(/^\//, "");
    if (!clean || clean === ".") return false;

    let ignored = false;
    for (const rule of this.rules) {
      if (rule.dirOnly && isDirectory === false) continue;
      if (rule.regex.test(clean)) {
        ignored = !rule.negated;
      }
    }
    return ignored;
  }
}

/** Skip deep checkpoint trees while still listing `.beide`. */
export function shouldSkipDir(
  name: string,
  relativeParent: string,
  matcher?: GitIgnoreMatcher | null,
): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true;
  const relParentClean = relativeParent.replace(/\\/g, "/");
  if (relParentClean.includes(".beide/checkpoints")) {
    return true;
  }
  if (matcher) {
    const fullRel = relParentClean ? `${relParentClean}/${name}` : name;
    if (matcher.ignores(fullRel, true)) return true;
  }
  return false;
}

