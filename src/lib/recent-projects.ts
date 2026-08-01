/**
 * Most-recent-first list of workspace roots for the welcome screen.
 *
 * Renderer-local on purpose: electron settings persist only the single
 * `lastWorkspacePath` (used for restore on launch), while this list is a UI
 * convenience — losing it costs nothing, so localStorage is enough. Entries
 * are never checked for existence here; opening a stale path fails through
 * the workspace store's normal error path.
 */

const STORAGE_KEY = "beide.recentProjects";
const MAX_RECENT_PROJECTS = 8;

/** Case-insensitive, separator-agnostic key — Windows paths compare loosely. */
function dedupeKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function getRecentProjects(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

/** Record a successful open: move (or insert) the path at the top. */
export function pushRecentProject(path: string): void {
  if (!path) return;
  const key = dedupeKey(path);
  const next = [
    path,
    ...getRecentProjects().filter((entry) => dedupeKey(entry) !== key),
  ].slice(0, MAX_RECENT_PROJECTS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage unavailable — the list is only a convenience */
  }
}

/** Display name for a workspace root: the last path segment. */
export function projectFolderName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const segments = trimmed.split(/[\\/]/);
  return segments[segments.length - 1] || trimmed;
}
