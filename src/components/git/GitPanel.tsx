import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceStore } from "../../stores/workspace";
import { getBeide, onBeide } from "../../lib/ipc";
import {
  REVIEW_DIFF_CAP,
  REVIEW_SYSTEM,
  buildReviewPrompt,
} from "../../lib/ai-review";
// Same markdown stack as chat and the editor preview — hard rule 7 in AGENTS.md.
import { Markdown } from "../agent-elements/markdown";
import { Button } from "../ui/button";

interface GitFileEntry {
  /** Path relative to the repo root, exactly as porcelain printed it. */
  path: string;
  /** Single status letter to show in the chip (untracked "??" → "U"). */
  code: string;
}

interface DiffSelection {
  path: string;
  staged: boolean;
}

/**
 * Parse `git status --porcelain` lines. First char (X) is the staged state,
 * second (Y) the unstaged one; "??" is untracked. A file can appear in both
 * lists (e.g. "MM" — staged and modified again).
 */
export function parsePorcelain(status: string): {
  staged: GitFileEntry[];
  changes: GitFileEntry[];
} {
  const staged: GitFileEntry[] = [];
  const changes: GitFileEntry[] = [];
  for (const raw of status.split("\n")) {
    if (raw.length < 4) continue; // shortest valid line is "XY p"
    const x = raw[0];
    const y = raw[1];
    let path = raw.slice(3).replace(/\r$/, "");
    // Renames/copies come as "old -> new"; the new path is the one that
    // exists on disk and the one git add/restore/diff expect.
    const arrow = path.indexOf(" -> ");
    if (arrow !== -1) path = path.slice(arrow + 4);
    // Porcelain quotes paths with special characters.
    if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
    if (!path) continue;
    if (x === "?" && y === "?") {
      changes.push({ path, code: "U" });
      continue;
    }
    if (x !== " " && x !== "?") staged.push({ path, code: x });
    if (y !== " ") changes.push({ path, code: y });
  }
  return { staged, changes };
}

/** Map a porcelain letter onto one of three chip tones. */
function chipTone(code: string): string {
  if (code === "A" || code === "U") return "is-add";
  if (code === "D") return "is-del";
  return "is-mod";
}

const AI_DIFF_CAP = 12_000;

export function GitPanel() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const openFolder = useWorkspaceStore((s) => s.openFolder);

  const [isRepo, setIsRepo] = useState<boolean | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [staged, setStaged] = useState<GitFileEntry[]>([]);
  const [changes, setChanges] = useState<GitFileEntry[]>([]);
  const [selected, setSelected] = useState<DiffSelection | null>(null);
  const [diff, setDiff] = useState("");
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewCollapsed, setReviewCollapsed] = useState(false);

  // Guards against out-of-order async results after quick clicks/refreshes.
  const diffSeq = useRef(0);
  // Same idea for reviews: dismissals and workspace switches invalidate an
  // in-flight ai.complete so its late result never resurfaces.
  const reviewSeq = useRef(0);

  const refresh = useCallback(async () => {
    const api = getBeide();
    if (!api || !rootPath) return;
    try {
      const s = await api.git.status();
      setIsRepo(s.isRepo);
      setBranch(s.branch);
      const parsed = s.isRepo
        ? parsePorcelain(s.status)
        : { staged: [], changes: [] };
      setStaged(parsed.staged);
      setChanges(parsed.changes);
    } catch {
      setIsRepo(false);
      setBranch(null);
      setStaged([]);
      setChanges([]);
    }
  }, [rootPath]);

  // Initial load + workspace switches.
  useEffect(() => {
    setSelected(null);
    setDiff("");
    setError(null);
    reviewSeq.current++;
    setReview(null);
    setReviewError(null);
    setReviewBusy(false);
    void refresh();
  }, [refresh]);

  // Anything that touches the workspace (agent edits, saves, checkpoint
  // restores) may change git state; debounce because the event can burst.
  useEffect(() => {
    let handle: number | null = null;
    const off = onBeide("workspace:changed", () => {
      if (handle !== null) window.clearTimeout(handle);
      handle = window.setTimeout(() => {
        handle = null;
        void refresh();
      }, 250);
    });
    return () => {
      if (handle !== null) window.clearTimeout(handle);
      off();
    };
  }, [refresh]);

  const loadDiff = useCallback(async (sel: DiffSelection) => {
    const api = getBeide();
    if (!api) return;
    const seq = ++diffSeq.current;
    try {
      const r = await api.git.diff(sel.path, sel.staged);
      if (diffSeq.current === seq) setDiff(r.diff);
    } catch {
      if (diffSeq.current === seq) setDiff("");
    }
  }, []);

  // Keep the diff in sync with the lists: drop the selection when the file
  // left its list (committed, fully staged/unstaged), refetch otherwise.
  useEffect(() => {
    if (!selected) return;
    const list = selected.staged ? staged : changes;
    if (!list.some((f) => f.path === selected.path)) {
      setSelected(null);
      setDiff("");
      return;
    }
    void loadDiff(selected);
  }, [staged, changes, selected, loadDiff]);

  const selectFile = (path: string, stagedList: boolean) => {
    const sel = { path, staged: stagedList };
    setSelected(sel);
    setDiff("");
    void loadDiff(sel);
  };

  const stageFile = async (path: string) => {
    const api = getBeide();
    if (!api) return;
    setError(null);
    try {
      const r = await api.git.stage(path);
      if (r.code !== 0) setError(r.stderr || r.stdout);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await refresh();
  };

  const unstageFile = async (path: string) => {
    const api = getBeide();
    if (!api) return;
    setError(null);
    try {
      const r = await api.git.unstage(path);
      if (r.code !== 0) setError(r.stderr || r.stdout);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    await refresh();
  };

  const commit = async () => {
    const api = getBeide();
    const msg = message.trim();
    if (!api || !msg || staged.length === 0 || committing) return;
    setCommitting(true);
    setError(null);
    try {
      const r = await api.git.commit(msg);
      if (r.code !== 0) {
        setError(r.stderr || r.stdout || t("git.commitFailed"));
      } else {
        setMessage("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("git.commitFailed"));
    } finally {
      setCommitting(false);
      await refresh();
    }
  };

  const generateMessage = async () => {
    const api = getBeide();
    if (!api || staged.length === 0 || aiBusy) return;
    setAiBusy(true);
    setError(null);
    try {
      let combined = "";
      for (const file of staged) {
        if (combined.length >= AI_DIFF_CAP) break;
        try {
          const r = await api.git.diff(file.path, true);
          if (r.diff) combined += `${r.diff}\n`;
        } catch {
          // one unreadable diff should not sink the whole prompt
        }
      }
      // Binary-only or empty diffs: fall back to the staged file list so the
      // model still has something to name.
      if (!combined.trim()) {
        combined = staged.map((f) => `${f.code} ${f.path}`).join("\n");
      }
      const res = await api.ai.complete({
        prompt: combined.slice(0, AI_DIFF_CAP),
        system:
          "Write a concise conventional-commit style message (one line, imperative, no quotes) for this diff.",
        maxTokens: 200,
      });
      if (res.ok && res.text?.trim()) {
        setMessage(res.text.trim().split("\n")[0]);
      } else {
        setError(res.error || t("git.aiFailed"));
      }
    } catch {
      setError(t("git.aiFailed"));
    } finally {
      setAiBusy(false);
    }
  };

  const runReview = async () => {
    const api = getBeide();
    if (!api || reviewBusy) return;
    if (staged.length === 0 && changes.length === 0) return;
    const seq = ++reviewSeq.current;
    setReviewBusy(true);
    setReview(null);
    setReviewError(null);
    setReviewCollapsed(false);
    try {
      // Staged and unstaged sides of every file; "MM" files legitimately
      // contribute two different diffs.
      let combined = "";
      const untracked: string[] = [];
      const targets = [
        ...staged.map((f) => ({ file: f, staged: true })),
        ...changes.map((f) => ({ file: f, staged: false })),
      ];
      for (const { file, staged: stagedSide } of targets) {
        if (combined.length >= REVIEW_DIFF_CAP) break;
        // `git diff` prints nothing for untracked files; list them instead.
        if (file.code === "U") {
          untracked.push(file.path);
          continue;
        }
        try {
          const r = await api.git.diff(file.path, stagedSide);
          if (r.diff) combined += `${r.diff}\n`;
        } catch {
          // one unreadable diff should not sink the whole review
        }
      }
      if (untracked.length > 0) {
        combined += `\nUntracked files (content not shown):\n${untracked
          .map((p) => `- ${p}`)
          .join("\n")}\n`;
      }
      // Binary-only changes: give the model at least the file list.
      if (!combined.trim()) {
        combined = targets
          .map(({ file }) => `${file.code} ${file.path}`)
          .join("\n");
      }
      const res = await api.ai.complete({
        prompt: buildReviewPrompt(combined),
        system: REVIEW_SYSTEM,
        maxTokens: 1_000,
      });
      if (reviewSeq.current !== seq) return;
      if (res.ok && res.text?.trim()) {
        setReview(res.text.trim());
      } else {
        setReviewError(res.error || t("git.reviewFailed"));
      }
    } catch {
      if (reviewSeq.current === seq) setReviewError(t("git.reviewFailed"));
    } finally {
      if (reviewSeq.current === seq) setReviewBusy(false);
    }
  };

  if (!rootPath) {
    return (
      <div className="editor-empty" style={{ padding: 20 }}>
        <p>{t("sidebar.noWorkspace")}</p>
        <Button type="button" size="sm" onClick={() => void openFolder()}>
          {t("common.openFolder")}
        </Button>
      </div>
    );
  }

  if (isRepo === false) {
    return <div className="git-panel__empty">{t("git.notRepo")}</div>;
  }

  if (isRepo === null) {
    return <div className="git-panel__empty">{t("common.loading")}</div>;
  }

  const renderList = (
    label: string,
    files: GitFileEntry[],
    stagedList: boolean,
  ) => (
    <section className="git-panel__section">
      <div className="git-panel__section-title">
        {label}
        <span className="git-panel__count">{files.length}</span>
      </div>
      {files.map((file) => {
        const isSelected =
          selected?.path === file.path && selected.staged === stagedList;
        const actionLabel = stagedList ? t("git.unstage") : t("git.stage");
        return (
          <div
            key={`${stagedList ? "s" : "c"}:${file.path}`}
            role="button"
            tabIndex={0}
            title={file.path}
            className={`git-panel__file${isSelected ? " is-selected" : ""}`}
            onClick={() => selectFile(file.path, stagedList)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectFile(file.path, stagedList);
              }
            }}
          >
            <span
              className={`git-panel__chip ${chipTone(file.code)}`}
              aria-hidden
            >
              {file.code}
            </span>
            <span className="git-panel__path">
              <bdi>{file.path}</bdi>
            </span>
            <button
              type="button"
              className="git-panel__action"
              title={actionLabel}
              aria-label={`${actionLabel}: ${file.path}`}
              onClick={(e) => {
                e.stopPropagation();
                void (stagedList ? unstageFile(file.path) : stageFile(file.path));
              }}
            >
              {stagedList ? "−" : "+"}
            </button>
          </div>
        );
      })}
    </section>
  );

  return (
    <div className="git-panel">
      <div className="git-panel__branch" aria-label={t("git.branch")}>
        <span className="git-panel__branch-name" title={branch ?? undefined}>
          {branch ?? "—"}
        </span>
      </div>

      <div className="git-panel__lists">
        {staged.length === 0 && changes.length === 0 ? (
          <div className="git-panel__empty">{t("git.noChanges")}</div>
        ) : (
          <>
            {renderList(t("git.staged"), staged, true)}
            {renderList(t("git.changes"), changes, false)}
          </>
        )}
      </div>

      {(reviewBusy || review !== null || reviewError !== null) && (
        <section className="git-panel__diff" aria-label={t("git.reviewTitle")}>
          <div className="git-panel__section-title">
            <span style={{ flex: 1 }}>{t("git.reviewTitle")}</span>
            {/* __action buttons live at opacity 0 outside a hovered file row;
                these are always visible, hence the inline override. */}
            {review !== null && (
              <button
                type="button"
                className="git-panel__action"
                style={{ opacity: 1 }}
                title={
                  reviewCollapsed ? t("git.reviewExpand") : t("git.reviewCollapse")
                }
                aria-label={
                  reviewCollapsed ? t("git.reviewExpand") : t("git.reviewCollapse")
                }
                aria-expanded={!reviewCollapsed}
                onClick={() => setReviewCollapsed((c) => !c)}
              >
                {reviewCollapsed ? "▸" : "▾"}
              </button>
            )}
            <button
              type="button"
              className="git-panel__action"
              style={{ opacity: 1 }}
              title={t("git.reviewDismiss")}
              aria-label={t("git.reviewDismiss")}
              onClick={() => {
                reviewSeq.current++;
                setReview(null);
                setReviewError(null);
                setReviewBusy(false);
              }}
            >
              ×
            </button>
          </div>
          {reviewBusy ? (
            <div className="git-panel__empty">{t("git.reviewRunning")}</div>
          ) : reviewError ? (
            <div
              className="git-panel__error"
              style={{ padding: "0 10px 8px" }}
            >
              {reviewError}
            </div>
          ) : review !== null && !reviewCollapsed ? (
            <div style={{ padding: "0 10px 8px", userSelect: "text" }}>
              <Markdown content={review} />
            </div>
          ) : null}
        </section>
      )}

      {selected && (
        <div className="git-panel__diff">
          {diff ? (
            <pre className="git-panel__diff-pre">{diff}</pre>
          ) : (
            <div className="git-panel__empty">{t("git.diffEmpty")}</div>
          )}
        </div>
      )}

      <div className="git-panel__commit">
        <textarea
          className="git-panel__message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("git.commitPlaceholder")}
          rows={3}
          spellCheck={false}
        />
        {error && <div className="git-panel__error">{error}</div>}
        <div className="git-panel__commit-row">
          <Button
            type="button"
            size="sm"
            className="git-panel__commit-btn"
            disabled={staged.length === 0 || !message.trim() || committing}
            onClick={() => void commit()}
          >
            {t("git.commit")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={t("git.generate")}
            aria-label={t("git.generate")}
            disabled={staged.length === 0 || aiBusy}
            onClick={() => void generateMessage()}
          >
            {aiBusy ? "…" : "✨"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            title={t("git.review")}
            aria-label={t("git.review")}
            disabled={(staged.length === 0 && changes.length === 0) || reviewBusy}
            onClick={() => void runReview()}
          >
            {reviewBusy ? "…" : "🔍"}
          </Button>
        </div>
      </div>
    </div>
  );
}
