/**
 * "Changes by agent" bar — a slim strip under the TabBar that surfaces recent
 * agent checkpoints (< 30 min old). Expanding it lists checkpoints with their
 * files; clicking a file opens a read-only Monaco diff (snapshot before the
 * agent's write vs the file's current content) with a rollback button.
 *
 * Monaco runtime values come exclusively from EditorArea's OnMount args via
 * the `getMonaco` prop — this module only imports Monaco types, so it stays in
 * the lazy editor chunk without pulling the runtime a second time.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  IconChevronDown,
  IconHistory,
  IconRestore,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getBeide } from "../../lib/ipc";
import { fileNameFromPath, languageFromPath } from "../../lib/language";
import type { CheckpointInfo } from "../../lib/types";

type Monaco = Parameters<OnMount>[1];

const RECENT_WINDOW_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 60_000;
const MAX_LISTED = 10;

interface CheckpointEntry {
  path: string;
  existed: boolean;
  before: string | null;
  after: string | null;
  binary: boolean;
}

interface DiffState {
  checkpoint: CheckpointInfo;
  /** null → the checkpoint has no snapshot entry for the clicked path. */
  entry: CheckpointEntry | null;
}

function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, "/");
}

function relativeTime(t: TFunction, createdAt: number): string {
  const mins = Math.round((Date.now() - createdAt) / 60_000);
  if (mins < 1) return t("editor.agentTimeNow");
  return t("editor.agentTimeMin", { minutes: mins });
}

/**
 * Hosts monaco.editor.createDiffEditor over two throwaway inmemory:// models.
 * EditorArea's orphan-model sweep skips the inmemory scheme, so a tabs change
 * while the overlay is open cannot dispose these models under the editor.
 */
function CheckpointDiffView({
  monaco,
  entry,
}: {
  monaco: Monaco;
  entry: CheckpointEntry;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const language = languageFromPath(entry.path);
    const original = monaco.editor.createModel(entry.before ?? "", language);
    const modified = monaco.editor.createModel(entry.after ?? "", language);
    const diffEditor = monaco.editor.createDiffEditor(node, {
      readOnly: true,
      originalEditable: false,
      automaticLayout: true,
      renderOverviewRuler: false,
      minimap: { enabled: false },
      fontSize: 12,
      scrollBeyondLastLine: false,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    });
    diffEditor.setModel({ original, modified });
    return () => {
      diffEditor.dispose();
      original.dispose();
      modified.dispose();
    };
  }, [monaco, entry]);

  return <div ref={hostRef} className="editor-agent-diff__host" />;
}

export function AgentChangesBar({
  getMonaco,
}: {
  getMonaco: () => Monaco | null;
}) {
  const { t } = useTranslation();
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffState | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const api = getBeide();
    if (!api) return;
    try {
      setCheckpoints(await api.checkpoint.list());
    } catch {
      /* transient IPC failure — keep the last known list */
    }
  }, []);

  // Poll: on mount, when the window regains focus, and every 60s. A single
  // cheap IPC list call each time; the diff entries are fetched on demand.
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [refresh]);

  // Escape closes the diff overlay.
  useEffect(() => {
    if (!diff) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDiff(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [diff]);

  const now = Date.now();
  const recent = checkpoints
    .filter((cp) => now - cp.createdAt < RECENT_WINDOW_MS)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_LISTED);

  // Keep the overlay alive even if the last checkpoint ages out mid-view.
  if (recent.length === 0 && !diff) return null;

  const fileCount = new Set(
    recent.flatMap((cp) => cp.files.map(normalizeSlashes)),
  ).size;

  const openDiff = async (cp: CheckpointInfo, path: string) => {
    const api = getBeide();
    if (!api || loadingId) return;
    setLoadingId(cp.id);
    setError(null);
    try {
      const entries: CheckpointEntry[] = await api.checkpoint.entries(cp.id);
      const entry =
        entries.find(
          (e) => normalizeSlashes(e.path) === normalizeSlashes(path),
        ) ?? null;
      setDiff({ checkpoint: cp, entry });
    } catch {
      setError(t("editor.agentEntriesFailed"));
    } finally {
      setLoadingId(null);
    }
  };

  const restore = async () => {
    const api = getBeide();
    if (!api || !diff || restoring) return;
    if (
      !window.confirm(
        t("editor.restoreCheckpointConfirm", { label: diff.checkpoint.label }),
      )
    ) {
      return;
    }
    setRestoring(true);
    setError(null);
    try {
      // Main emits workspace:changed after the restore, which reloads open
      // non-dirty tabs (AppLayout) — no manual buffer reconciliation here.
      await api.checkpoint.restore(diff.checkpoint.id);
      setDiff(null);
      await refresh();
    } catch {
      setError(t("editor.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  };

  const monaco = getMonaco();

  return (
    <>
      {recent.length > 0 && (
        <div className="editor-agent-bar">
          <button
            type="button"
            className="editor-agent-bar__summary"
            aria-expanded={expanded}
            aria-label={t("editor.agentChangesToggle")}
            onClick={() => setExpanded((v) => !v)}
          >
            <IconHistory size={14} stroke={1.75} />
            <span>{t("editor.agentChanges", { count: fileCount })}</span>
            <IconChevronDown
              size={14}
              stroke={1.75}
              className="editor-agent-bar__chevron"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
          </button>
          {expanded && (
            <div className="editor-agent-bar__list">
              {recent.map((cp) => (
                <div key={cp.id} className="editor-agent-checkpoint">
                  <div className="editor-agent-checkpoint__meta">
                    <strong>{cp.label}</strong>
                    <span className="editor-agent-checkpoint__time">
                      {relativeTime(t, cp.createdAt)}
                    </span>
                    {loadingId === cp.id && <Spinner size="sm" />}
                  </div>
                  <div className="editor-agent-checkpoint__files">
                    {cp.files.map((path) => (
                      <button
                        key={path}
                        type="button"
                        className="editor-agent-file"
                        title={path}
                        onClick={() => void openDiff(cp, path)}
                      >
                        {fileNameFromPath(path)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!diff && error && (
                <p className="editor-agent-bar__error">{error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {diff && (
        <div
          className="editor-agent-diff"
          role="dialog"
          aria-modal="true"
          aria-label={t("editor.agentDiffTitle")}
        >
          <div className="editor-agent-diff__panel">
            <header className="editor-agent-diff__header">
              <div className="editor-agent-diff__title">
                <strong title={diff.entry?.path}>
                  {diff.entry
                    ? fileNameFromPath(diff.entry.path)
                    : t("editor.agentDiffTitle")}
                </strong>
                <span>
                  {diff.checkpoint.label} ·{" "}
                  {relativeTime(t, diff.checkpoint.createdAt)}
                </span>
              </div>
              <div className="editor-agent-diff__actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={restoring}
                  onClick={() => void restore()}
                >
                  {restoring ? (
                    <Spinner size="sm" />
                  ) : (
                    <IconRestore size={14} stroke={1.75} />
                  )}
                  {t("editor.restoreCheckpoint")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("common.close")}
                  onClick={() => setDiff(null)}
                >
                  <IconX size={14} stroke={1.75} />
                </Button>
              </div>
            </header>
            {error && <p className="editor-agent-diff__error">{error}</p>}
            <div className="editor-agent-diff__body">
              {!diff.entry ? (
                <p className="editor-agent-diff__note">
                  {t("editor.agentDiffNotFound")}
                </p>
              ) : diff.entry.binary ? (
                <p className="editor-agent-diff__note">
                  {t("editor.agentDiffBinary")}
                </p>
              ) : monaco ? (
                <CheckpointDiffView monaco={monaco} entry={diff.entry} />
              ) : (
                <p className="editor-agent-diff__note">
                  {t("editor.agentDiffNoEditor")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
