/**
 * AI ghost-text autocompletion (Monaco inline completions).
 *
 * Registered from EditorArea's onMount with the (editor, monaco) instances it
 * received — this module only imports Monaco *types*, never the runtime, so it
 * stays inert until the editor chunk loads.
 *
 * The provider is deliberately conservative: 250ms debounce, stale-request
 * cancellation via the CancellationToken plus a sequence counter, skipped
 * entirely for huge files or a non-empty selection.
 */
import type { OnMount } from "@monaco-editor/react";
import type {
  CancellationToken,
  IDisposable,
  Position,
  editor as MonacoEditorNs,
  languages,
} from "monaco-editor";
import { getBeide } from "../../lib/ipc";

type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

const STORAGE_KEY = "beide.ghostText";
const GHOST_MODEL = "gemini-3.6-flash";
const GHOST_SYSTEM =
  "Complete the code at <CURSOR>. Return ONLY the inserted text, no fences, max ~6 lines.";
const DEBOUNCE_MS = 250;
const MAX_FILE_CHARS = 200_000;
const MAX_OUTPUT_LINES = 8;
const LINES_ABOVE = 60;
const LINES_BELOW = 15;

/** Persisted toggle; default ON when the key is absent. */
export function isGhostTextEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setGhostTextEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* localStorage unavailable — session-only default stays ON */
  }
}

/** Flip the persisted toggle and return the new state. */
export function toggleGhostText(): boolean {
  const next = !isGhostTextEnabled();
  setGhostTextEnabled(next);
  return next;
}

/** Debounce that resolves early (as a no-op) when the request is cancelled. */
function debounceDelay(ms: number, token: CancellationToken): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.dispose();
      resolve();
    }, ms);
    const sub = token.onCancellationRequested(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** 60 lines above + 15 below the cursor with a <CURSOR> marker. */
function buildCompletionPrompt(
  model: MonacoEditorNs.ITextModel,
  position: Position,
): string {
  const startLine = Math.max(1, position.lineNumber - LINES_ABOVE);
  const endLine = Math.min(model.getLineCount(), position.lineNumber + LINES_BELOW);
  const before = model.getValueInRange({
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });
  const after = model.getValueInRange({
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: endLine,
    endColumn: model.getLineMaxColumn(endLine),
  });
  return `Language: ${model.getLanguageId()}\n\n${before}<CURSOR>${after}`;
}

/**
 * Gentler cleanup than the Ctrl+K one: fences go, but leading whitespace on
 * the first line is preserved (it may be continuation indentation), and the
 * result is capped at 8 lines.
 */
function cleanCompletion(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  text = text.replace(/^\s*```[^\n]*\n/, "");
  text = text.replace(/\n?```\s*$/, "");
  text = text.replace(/^\n+/, "");
  const lines = text.split("\n").slice(0, MAX_OUTPUT_LINES);
  return lines.join("\n").replace(/\s+$/, "");
}

/**
 * Register the "*" inline-completions provider. Returns the disposable —
 * EditorArea keeps it in a ref and disposes on unmount (markerSubRef pattern).
 */
export function registerGhostText(
  editor: MonacoEditor,
  monaco: Monaco,
): IDisposable {
  // Monotonic sequence: any newer keystroke invalidates in-flight replies even
  // if Monaco is slow to fire the cancellation token.
  let requestSeq = 0;

  const provider: languages.InlineCompletionsProvider = {
    provideInlineCompletions: async (
      model,
      position,
      _context,
      token,
    ): Promise<languages.InlineCompletions> => {
      const empty: languages.InlineCompletions = { items: [] };

      if (!isGhostTextEnabled()) return empty;
      if (model.getValueLength() > MAX_FILE_CHARS) return empty;
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) return empty;
      const api = getBeide();
      if (!api) return empty;

      const seq = ++requestSeq;
      await debounceDelay(DEBOUNCE_MS, token);
      if (token.isCancellationRequested || seq !== requestSeq) return empty;
      if (model.isDisposed()) return empty;

      let reply: { ok: boolean; text?: string; error?: string };
      try {
        reply = await api.ai.complete({
          prompt: buildCompletionPrompt(model, position),
          system: GHOST_SYSTEM,
          model: GHOST_MODEL,
          maxTokens: 160,
        });
      } catch {
        return empty;
      }
      if (token.isCancellationRequested || seq !== requestSeq) return empty;
      if (!reply.ok || typeof reply.text !== "string") return empty;

      const text = cleanCompletion(reply.text);
      if (!text) return empty;

      return {
        items: [
          {
            insertText: text,
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
          },
        ],
      };
    },
    freeInlineCompletions: () => {
      /* nothing retained per completion */
    },
  };

  return monaco.languages.registerInlineCompletionsProvider("*", provider);
}
