import { homedir } from "node:os";
import { join, normalize, resolve, sep } from "node:path";

/** Global pi agent directory (~/.pi/agent). */
export function getPiAgentDir(): string {
  return join(homedir(), ".pi", "agent");
}

/** Workspace-local beide metadata root. */
export function getBeideRoot(workspaceRoot: string): string {
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

/** Relative path from workspace root using forward slashes for UI. */
export function toWorkspaceRelative(workspaceRoot: string, absolutePath: string): string {
  const root = resolve(workspaceRoot);
  const abs = resolve(absolutePath);
  if (abs === root) return ".";
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (!abs.startsWith(rootWithSep)) return normalize(abs).replace(/\\/g, "/");
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

/** Skip deep checkpoint trees while still listing `.beide`. */
export function shouldSkipDir(name: string, relativeParent: string): boolean {
  if (SKIP_DIR_NAMES.has(name)) return true;
  // Skip checkpoint file copies (can be large); still list the folder names if needed
  if (relativeParent.replace(/\\/g, "/").includes(".beide/checkpoints")) {
    return true;
  }
  return false;
}
