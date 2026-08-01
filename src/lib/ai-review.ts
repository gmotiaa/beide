/**
 * Prompt plumbing for the Git panel's "AI review" button. Kept out of the
 * component so the cap and the wording are easy to tune in one place.
 */

/**
 * Hard cap for the combined diff sent to ai:complete. The IPC handler
 * rejects prompts over 64 000 chars (electron/ipc.ts), so 60 000 leaves
 * headroom for the truncation note and the untracked-files appendix.
 */
export const REVIEW_DIFF_CAP = 60_000;

/** System prompt: strict reviewer, short concrete findings, plain markdown. */
export const REVIEW_SYSTEM = [
  "You are a strict code reviewer looking at a git diff of pending changes.",
  "Reply in plain markdown with no preamble and no praise.",
  "If you find problems, return a short bullet list of concrete findings",
  "(bugs, typos, risky changes); start each bullet with the file path in",
  "backticks followed by a one-line explanation.",
  "If the changes look fine, reply with the single line: **All clear.**",
].join(" ");

/** Cap the diff, appending a note so the model knows the tail is missing. */
export function buildReviewPrompt(diff: string): string {
  if (diff.length <= REVIEW_DIFF_CAP) return diff;
  return `${diff.slice(0, REVIEW_DIFF_CAP)}\n\n[diff truncated at ${REVIEW_DIFF_CAP} characters — review only what is shown]`;
}
