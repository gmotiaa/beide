/**
 * Helpers for the Ctrl+K inline AI edit (EditorArea action "beide.inlineEdit").
 *
 * Pure logic only. Runtime Monaco values (Range, editor instance) must come
 * from the OnMount arguments EditorArea passes in — this module only imports
 * types, so it never drags the monaco-editor runtime into an eager chunk.
 */
import type { OnMount } from "@monaco-editor/react";
import type { IRange, editor as MonacoEditorNs } from "monaco-editor";

// ICodeEditor (not IStandaloneCodeEditor): action `run` callbacks receive the
// wider interface, and everything used here exists on it.
type MonacoEditor = MonacoEditorNs.ICodeEditor;
type Monaco = Parameters<OnMount>[1];

export interface InlineEditTarget {
  /** Range that will be replaced (selection, or the whole current line). */
  range: IRange;
  /** Model uri at capture time — guards against applying to another tab. */
  uri: string;
  language: string;
  fragment: string;
  contextBefore: string;
  contextAfter: string;
}

export const INLINE_EDIT_SYSTEM =
  "You are a code editor. Return ONLY the replacement code for the given fragment, no fences, no commentary.";

const CONTEXT_LINES = 20;

/**
 * Snapshot the fragment to edit: the current selection, or the current line
 * when the selection is empty, plus ±20 lines of surrounding context.
 */
export function getInlineEditTarget(
  editor: MonacoEditor,
  monaco: Monaco,
): InlineEditTarget | null {
  const model = editor.getModel();
  if (!model) return null;

  const selection = editor.getSelection();
  let range: IRange;
  if (selection && !selection.isEmpty()) {
    range = {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    };
  } else {
    const line = editor.getPosition()?.lineNumber ?? 1;
    range = {
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: model.getLineMaxColumn(line),
    };
  }

  const firstBefore = Math.max(1, range.startLineNumber - CONTEXT_LINES);
  const contextBefore =
    range.startLineNumber > 1
      ? model.getValueInRange(
          new monaco.Range(
            firstBefore,
            1,
            range.startLineNumber - 1,
            model.getLineMaxColumn(range.startLineNumber - 1),
          ),
        )
      : "";

  const lastAfter = Math.min(
    model.getLineCount(),
    range.endLineNumber + CONTEXT_LINES,
  );
  const contextAfter =
    range.endLineNumber < model.getLineCount()
      ? model.getValueInRange(
          new monaco.Range(
            range.endLineNumber + 1,
            1,
            lastAfter,
            model.getLineMaxColumn(lastAfter),
          ),
        )
      : "";

  return {
    range,
    uri: model.uri.toString(),
    language: model.getLanguageId(),
    fragment: model.getValueInRange(range),
    contextBefore,
    contextAfter,
  };
}

/** User prompt for ai.complete: language, instruction, fragment, ±context. */
export function buildInlineEditPrompt(
  target: InlineEditTarget,
  instruction: string,
): string {
  return [
    `Language: ${target.language}`,
    `Instruction: ${instruction}`,
    "",
    "=== CONTEXT BEFORE (for reference only, do NOT include in the answer) ===",
    target.contextBefore || "(start of file)",
    "",
    "=== FRAGMENT TO REPLACE (answer with the replacement for exactly this) ===",
    target.fragment,
    "",
    "=== CONTEXT AFTER (for reference only, do NOT include in the answer) ===",
    target.contextAfter || "(end of file)",
  ].join("\n");
}

/**
 * Defensive fence stripping: models sometimes wrap the reply in ```lang …```
 * despite the system prompt.
 */
export function stripCodeFences(text: string): string {
  let out = text.replace(/\r\n/g, "\n").trim();
  const fenced = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(out);
  if (fenced) return fenced[1];
  if (out.startsWith("```")) out = out.replace(/^```[^\n]*\n?/, "");
  if (out.endsWith("```")) out = out.replace(/\n?```$/, "");
  return out;
}

/**
 * Replace the target range in a single undo unit. Ctrl+Z is the reject path,
 * so the edit must never merge with surrounding typing.
 */
export function applyInlineEdit(
  editor: MonacoEditor,
  target: InlineEditTarget,
  text: string,
): void {
  editor.pushUndoStop();
  editor.executeEdits("beide.inlineEdit", [
    { range: target.range, text, forceMoveMarkers: true },
  ]);
  editor.pushUndoStop();
}
