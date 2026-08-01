import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
// Wires Monaco + workers into the loader. Lives here (not main.tsx) so the
// whole Monaco bundle belongs to this lazy chunk, off the startup path.
import "../../monaco-setup";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditorNs } from "monaco-editor";
import { useTranslation } from "react-i18next";
import {
  IconAlertTriangle,
  IconFolderOpen,
  IconMessageChatbot,
  IconTerminal2,
  IconX,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { TabBar } from "./TabBar";
import { AgentChangesBar } from "./AgentChangesBar";
import { MarkdownPreview } from "./MarkdownPreview";
import {
  applyInlineEdit,
  buildInlineEditPrompt,
  getInlineEditTarget,
  INLINE_EDIT_SYSTEM,
  stripCodeFences,
  type InlineEditTarget,
} from "./inline-edit";
import { registerGhostText, toggleGhostText } from "./ghost-text";
import { getBeide } from "../../lib/ipc";
import { useAgentStore } from "../../stores/agent";
import { useChatStore } from "../../stores/chat";
import { useEditorStore } from "../../stores/editor";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";

interface EditorAreaProps {
  emptyAction?: ReactNode;
}

/** Ctrl+K overlay: position (px inside .editor-host), target and request state. */
interface InlineEditState {
  top: number;
  left: number;
  target: InlineEditTarget;
  busy: boolean;
  error: string | null;
}

const INLINE_EDIT_WIDGET_WIDTH = 380;
const INLINE_EDIT_MODEL_FALLBACK = "gemini-3.6-flash";

// Shared by the primary editor and the split pane so the two stay identical.
const EDITOR_OPTIONS: MonacoEditorNs.IStandaloneEditorConstructionOptions = {
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  fontLigatures: true,
  minimap: { enabled: false },
  smoothScrolling: true,
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  padding: { top: 12, bottom: 12 },
  scrollBeyondLastLine: false,
  renderLineHighlight: "line",
  tabSize: 2,
  automaticLayout: true,
  wordWrap: "off",
  bracketPairColorization: { enabled: true },
  stickyScroll: { enabled: true },
  inlineSuggest: { enabled: true },
};

function monacoThemeFor(theme: string): string {
  if (theme === "light") return "beide-light";
  if (theme === "midnight") return "beide-midnight";
  return "beide-dark";
}

function disposeOrphanModels(
  monaco: Parameters<OnMount>[1],
  openPaths: string[],
): void {
  const open = new Set(openPaths.map((path) => monaco.Uri.parse(path).toString()));
  for (const model of monaco.editor.getModels()) {
    // inmemory:// models belong to transient owners (the agent-changes diff
    // overlay, Monaco internals) that dispose them themselves — not ours to reap.
    if (model.uri.scheme === "inmemory") continue;
    if (!open.has(model.uri.toString())) model.dispose();
  }
}

function EditorWelcome({
  title,
  body,
  action,
  showShortcuts,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  showShortcuts?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="editor-empty">
      <div className="editor-empty__glow" aria-hidden />
      <div className="editor-empty__surface rounded-3xl border border-border bg-card text-card-foreground shadow-sm">
        <div className="editor-empty__mark" aria-hidden>
          b
        </div>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          {t("editor.welcomeBadge")}
        </Badge>
        <h1 className="editor-empty__title">{title}</h1>
        <p className="editor-empty__body">{body}</p>

        {action && <div className="editor-empty__action">{action}</div>}

        {showShortcuts && (
          <div className="editor-empty__grid">
            <Card size="sm" className="editor-empty__tip bg-secondary">
              <CardHeader className="gap-2">
                <div className="editor-empty__tip-icon">
                  <IconFolderOpen size={18} stroke={1.75} />
                </div>
                <CardTitle className="text-sm">
                  {t("editor.tipWorkspaceTitle")}
                </CardTitle>
                <CardDescription>{t("editor.tipWorkspace")}</CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>O</Kbd>
                </KbdGroup>
              </CardFooter>
            </Card>

            <Card size="sm" className="editor-empty__tip bg-secondary">
              <CardHeader className="gap-2">
                <div className="editor-empty__tip-icon">
                  <IconMessageChatbot size={18} stroke={1.75} />
                </div>
                <CardTitle className="text-sm">
                  {t("editor.tipAgentTitle")}
                </CardTitle>
                <CardDescription>{t("editor.tipAgent")}</CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>L</Kbd>
                </KbdGroup>
              </CardFooter>
            </Card>

            <Card size="sm" className="editor-empty__tip bg-secondary">
              <CardHeader className="gap-2">
                <div className="editor-empty__tip-icon">
                  <IconTerminal2 size={18} stroke={1.75} />
                </div>
                <CardTitle className="text-sm">
                  {t("editor.tipTerminalTitle")}
                </CardTitle>
                <CardDescription>{t("editor.tipTerminal")}</CardDescription>
              </CardHeader>
              <CardFooter className="gap-2">
                <KbdGroup>
                  <Kbd>Ctrl</Kbd>
                  <Kbd>`</Kbd>
                </KbdGroup>
              </CardFooter>
            </Card>
          </div>
        )}

        <div className="editor-empty__chips">
          <Badge variant="secondary">Monaco</Badge>
          <Badge>pi · GPT · Claude · Gemini</Badge>
          <Badge variant="secondary">Plan / Agent</Badge>
        </div>
      </div>
    </div>
  );
}

export function EditorArea({ emptyAction }: EditorAreaProps) {
  const { t } = useTranslation();
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const splitPath = useEditorStore((s) => s.splitPath);
  const setSplit = useEditorStore((s) => s.setSplit);
  const updateContent = useEditorStore((s) => s.updateContent);
  const setMonaco = useEditorStore((s) => s.setMonaco);
  const setCursor = useEditorStore((s) => s.setCursor);
  const theme = useSettingsStore((s) => s.settings.theme);
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const openFolder = useWorkspaceStore((s) => s.openFolder);

  const active = tabs.find((tab) => tab.path === activePath) ?? null;
  const lastError = useEditorStore((s) => s.lastError);
  const opening = useEditorStore((s) => s.opening);
  const clearError = useEditorStore((s) => s.clearError);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const markerSubRef = useRef<{ dispose: () => void } | null>(null);
  const ghostTextRef = useRef<{ dispose: () => void } | null>(null);

  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const [inlineInstruction, setInlineInstruction] = useState("");
  const [mdPreview, setMdPreview] = useState(false);
  // Bumped whenever the overlay closes; a late AI reply from a cancelled
  // session must never touch the buffer.
  const inlineEditSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      markerSubRef.current?.dispose();
      markerSubRef.current = null;
      ghostTextRef.current?.dispose();
      ghostTextRef.current = null;
      setMonaco(null);
    };
  }, [setMonaco]);

  // The overlay's target range belongs to one model — switching tabs
  // invalidates it, so close instead of applying to the wrong file.
  useEffect(() => {
    inlineEditSeqRef.current += 1;
    setInlineEdit(null);
  }, [activePath]);

  const closeInlineEdit = useCallback(() => {
    inlineEditSeqRef.current += 1;
    setInlineEdit(null);
    editorRef.current?.focus();
  }, []);

  const submitInlineEdit = useCallback(async () => {
    const editor = editorRef.current;
    const state = inlineEdit;
    const instruction = inlineInstruction.trim();
    if (!editor || !state || state.busy || !instruction) return;
    const api = getBeide();
    if (!api) {
      setInlineEdit({ ...state, error: t("editor.inlineEditNoApi") });
      return;
    }
    setInlineEdit({ ...state, busy: true, error: null });
    const seq = inlineEditSeqRef.current;
    const model =
      useAgentStore.getState().model ?? INLINE_EDIT_MODEL_FALLBACK;
    try {
      const reply = await api.ai.complete({
        prompt: buildInlineEditPrompt(state.target, instruction),
        system: INLINE_EDIT_SYSTEM,
        model,
        maxTokens: 4096,
      });
      if (inlineEditSeqRef.current !== seq) return;
      if (!reply.ok || typeof reply.text !== "string") {
        setInlineEdit((cur) =>
          cur
            ? {
                ...cur,
                busy: false,
                error: reply.error || t("editor.inlineEditFailed"),
              }
            : cur,
        );
        return;
      }
      const current = editorRef.current;
      // Tab switched (or model swapped) while the request was in flight —
      // the captured range no longer points at the same text. Bail out.
      if (
        !current ||
        current.getModel()?.uri.toString() !== state.target.uri
      ) {
        setInlineEdit(null);
        return;
      }
      applyInlineEdit(current, state.target, stripCodeFences(reply.text));
      setInlineEdit(null);
      current.focus();
    } catch (err) {
      setInlineEdit((cur) =>
        cur
          ? {
              ...cur,
              busy: false,
              error: err instanceof Error ? err.message : String(err),
            }
          : cur,
      );
    }
  }, [inlineEdit, inlineInstruction, t]);

  // `keepCurrentModel` deliberately outlives tab switches, which also means a
  // closed tab's model is never reclaimed. Drop models with no tab behind them.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    disposeOrphanModels(monaco, tabs.map((tab) => tab.path));
  }, [tabs]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonaco(editor);

    // Tabs closed while this component was unmounted (e.g. Settings view open)
    // left their models behind — the sweep effect above couldn't run without
    // the ref. Reconcile once per mount.
    disposeOrphanModels(
      monaco,
      useEditorStore.getState().tabs.map((tab) => tab.path),
    );

    // Mirror Monaco markers into the editor store so the agent receives the
    // same diagnostics the user sees (docs/AGENT-RUNTIME.md: prompt preamble).
    markerSubRef.current?.dispose();
    markerSubRef.current = monaco.editor.onDidChangeMarkers(() => {
      const tabs = useEditorStore.getState().tabs;
      const uriToPath = new Map(
        tabs.map((tab) => [monaco.Uri.parse(tab.path).toString(), tab.path]),
      );
      const lines: string[] = [];
      for (const marker of monaco.editor.getModelMarkers({})) {
        const path = uriToPath.get(marker.resource.toString());
        if (!path) continue;
        // Warning=4, Error=8 — hints/infos are noise for the agent.
        if (marker.severity < 4) continue;
        lines.push(
          `${path}:${marker.startLineNumber} [${marker.severity >= 8 ? "error" : "warning"}] ${marker.message.replace(/\s+/g, " ").slice(0, 200)}`,
        );
        if (lines.length >= 40) break;
      }
      useEditorStore.getState().setDiagnostics(lines.join("\n"));
    });

    // The three editor themes mirror the palette in themes.css: the editor
    // surface is the same --panel the shell paints, and the caret/selection
    // carry the patina accent. They used to sit on their own (a red caret on
    // near-black, a purple one on white) which is why the editor never quite
    // looked like part of the app.
    monaco.editor.defineTheme("beide-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "comment", foreground: "676c6e", fontStyle: "italic" }],
      colors: {
        "editor.background": "#1c1f21",
        "editor.foreground": "#e9e7e2",
        "editorLineNumber.foreground": "#676c6e",
        "editorLineNumber.activeForeground": "#979c9d",
        "editor.selectionBackground": "#4fa88f33",
        "editor.inactiveSelectionBackground": "#4fa88f1a",
        "editor.lineHighlightBackground": "#24282a",
        "editorCursor.foreground": "#4fa88f",
        "editorWidget.background": "#24282a",
        "editorWidget.border": "#2b2f31",
        "editorIndentGuide.background": "#2b2f31",
        "editorIndentGuide.activeBackground": "#3b4143",
        "editorGutter.background": "#1c1f21",
        "editor.selectionHighlightBackground": "#4fa88f1a",
        "scrollbarSlider.background": "#3b414388",
        "scrollbarSlider.hoverBackground": "#4a5153",
      },
    });

    monaco.editor.defineTheme("beide-light", {
      base: "vs",
      inherit: true,
      rules: [{ token: "comment", foreground: "8a8f8c", fontStyle: "italic" }],
      colors: {
        "editor.background": "#fbfaf7",
        "editor.foreground": "#22252a",
        "editor.selectionBackground": "#2e7d6b2e",
        "editor.inactiveSelectionBackground": "#2e7d6b16",
        "editor.lineHighlightBackground": "#f1eee8",
        "editorCursor.foreground": "#2e7d6b",
        "editorGutter.background": "#fbfaf7",
        "editorLineNumber.foreground": "#9a9c99",
        "editorLineNumber.activeForeground": "#6e7379",
        "editorIndentGuide.background": "#ebe7df",
        "editorIndentGuide.activeBackground": "#dedad1",
        "editorWidget.background": "#fbfaf7",
        "editorWidget.border": "#dedad1",
        "editor.selectionHighlightBackground": "#2e7d6b16",
        "scrollbarSlider.background": "#c9c4b888",
        "scrollbarSlider.hoverBackground": "#b3ada0",
      },
    });

    monaco.editor.defineTheme("beide-midnight", {
      base: "vs-dark",
      inherit: true,
      rules: [{ token: "comment", foreground: "646a6c", fontStyle: "italic" }],
      colors: {
        "editor.background": "#141719",
        "editor.foreground": "#efede8",
        "editor.selectionBackground": "#5fbfa333",
        "editor.inactiveSelectionBackground": "#5fbfa31a",
        "editor.lineHighlightBackground": "#1c2022",
        "editorCursor.foreground": "#5fbfa3",
        "editorGutter.background": "#141719",
        "editorLineNumber.foreground": "#646a6c",
        "editorLineNumber.activeForeground": "#9aa0a1",
        "editorIndentGuide.background": "#22272a",
        "editorIndentGuide.activeBackground": "#333a3d",
        "editorWidget.background": "#1c2022",
        "editorWidget.border": "#22272a",
        "scrollbarSlider.background": "#333a3d88",
        "scrollbarSlider.hoverBackground": "#434a4d",
      },
    });

    monaco.editor.setTheme(monacoThemeFor(theme));

    editor.onDidChangeCursorPosition((e) => {
      setCursor(e.position.lineNumber, e.position.column);
    });

    // "Fix with AI" (editor context menu): pick the diagnostic under the
    // cursor/selection, wrap it with surrounding code and stage the prompt in
    // the chat composer instead of firing it — the user stays in control.
    editor.addAction({
      id: "beide.fixWithAI",
      label: t("editor.fixWithAI"),
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 99,
      run: (ed) => {
        const model = ed.getModel();
        if (!model) return;
        const position = ed.getPosition();
        const selection = ed.getSelection();
        const markers = monaco.editor
          .getModelMarkers({ resource: model.uri })
          .filter((m) => m.severity >= monaco.MarkerSeverity.Warning);

        const hasSelection = Boolean(selection && !selection.isEmpty());
        let marker = markers.find((m) =>
          hasSelection && selection
            ? m.startLineNumber <= selection.endLineNumber &&
              m.endLineNumber >= selection.startLineNumber
            : position != null &&
              m.startLineNumber <= position.lineNumber &&
              m.endLineNumber >= position.lineNumber,
        );
        // No diagnostic exactly under the caret — take the closest one so the
        // action still does something useful on a file with errors elsewhere.
        if (!marker && markers.length > 0 && position) {
          marker = [...markers].sort(
            (a, b) =>
              Math.abs(a.startLineNumber - position.lineNumber) -
              Math.abs(b.startLineNumber - position.lineNumber),
          )[0];
        }

        const line = marker?.startLineNumber ?? position?.lineNumber ?? 1;
        const startLine = Math.max(1, line - 10);
        const endLine = Math.min(model.getLineCount(), line + 10);
        const context = model.getValueInRange(
          new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine)),
        );

        const fileName = model.uri.path.split("/").pop() || model.uri.path;
        const location = `${fileName}:${line}`;
        const head = marker
          ? t("editor.fixWithAIPrompt", { location, message: marker.message })
          : t("editor.fixWithAINoMarker", { location });
        const text = `${head}\n\n${t("editor.fixWithAIContext")}:\n\`\`\`\n${context}\n\`\`\``;

        useChatStore.getState().setDraft(text);
        document.getElementById("chat-composer")?.focus();
      },
    });

    // Ctrl+K inline edit: capture the selection (or current line), open the
    // instruction overlay near the top of the fragment. The AI reply replaces
    // the range in one undo unit — Ctrl+Z is the reject path.
    editor.addAction({
      id: "beide.inlineEdit",
      label: t("editor.inlineEdit"),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 98,
      run: (ed) => {
        const target = getInlineEditTarget(ed, monaco);
        if (!target) return;
        const anchor = ed.getScrolledVisiblePosition({
          lineNumber: target.range.startLineNumber,
          column: target.range.startColumn,
        });
        const hostWidth = ed.getDomNode()?.clientWidth ?? 800;
        const top = Math.max(4, (anchor?.top ?? 40) - 38);
        const left = Math.min(
          Math.max(8, anchor?.left ?? 8),
          Math.max(8, hostWidth - INLINE_EDIT_WIDGET_WIDTH - 8),
        );
        setInlineInstruction("");
        setInlineEdit({ top, left, target, busy: false, error: null });
      },
    });

    // AI ghost text: global inline-completions provider, disposed on unmount
    // (same lifecycle as markerSubRef above).
    ghostTextRef.current?.dispose();
    ghostTextRef.current = registerGhostText(editor, monaco);

    editor.addAction({
      id: "beide.toggleGhostText",
      label: t("editor.toggleGhostText"),
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 100,
      run: () => {
        toggleGhostText();
      },
    });
  };

  const errorBanner = lastError ? (
    <Alert
      variant="destructive"
      className="editor-banner-alert rounded-none border-x-0 border-t-0 pr-11"
    >
      <IconAlertTriangle size={16} stroke={1.75} />
      <AlertTitle>{t("common.error")}</AlertTitle>
      <AlertDescription>{lastError}</AlertDescription>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("common.close")}
        onClick={clearError}
        className="absolute top-2 right-2"
      >
        <IconX size={14} stroke={1.75} />
      </Button>
    </Alert>
  ) : null;

  if (!rootPath) {
    return (
      <div className="editor-area">
        <EditorWelcome
          title={t("editor.welcomeTitle")}
          body={t("common.openFolderHint")}
          showShortcuts
          action={
            emptyAction ?? (
              <Button size="lg" onClick={() => void openFolder()}>
                <IconFolderOpen size={18} stroke={1.75} />
                {t("common.openFolder")}
              </Button>
            )
          }
        />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="editor-area">
        {errorBanner}
        <EditorWelcome
          title={t("editor.welcomeTitle")}
          body={opening ? t("common.loading") : t("editor.welcomeBody")}
          action={
            opening ? (
              <div className="editor-empty__loading">
                <Spinner size="lg" />
              </div>
            ) : (
              emptyAction
            )
          }
        />
      </div>
    );
  }

  const isMarkdown = active.language === "markdown";
  const showPreview = isMarkdown && mdPreview;
  const splitTab =
    splitPath !== null
      ? (tabs.find((tab) => tab.path === splitPath) ?? null)
      : null;

  const editorLoading = (
    <div className="editor-loading">
      <Spinner size="sm" />
      <span>{t("common.loading")}</span>
    </div>
  );

  // One JSX value used by both layouts so the single-editor path stays
  // byte-identical to what it was before the split view existed.
  const primaryEditor = (
    <Editor
      height="100%"
      width="100%"
      path={active.path}
      language={active.language}
      value={active.content}
      theme={monacoThemeFor(theme)}
      loading={editorLoading}
      onMount={onMount}
      keepCurrentModel
      onChange={(value) => {
        if (activePath) updateContent(activePath, value ?? "");
      }}
      options={EDITOR_OPTIONS}
    />
  );

  return (
    <div className="editor-area">
      <TabBar
        mdPreviewAvailable={isMarkdown}
        mdPreviewOn={showPreview}
        onToggleMdPreview={() => {
          // The Ctrl+K overlay's range belongs to the editor being hidden.
          inlineEditSeqRef.current += 1;
          setInlineEdit(null);
          setMdPreview((v) => !v);
        }}
      />
      <AgentChangesBar getMonaco={() => monacoRef.current} />
      {errorBanner}
      <div className="editor-host">
        {showPreview ? (
          <MarkdownPreview content={active.content} />
        ) : splitTab ? (
          <div className="editor-split">
            <div className="editor-split__pane">{primaryEditor}</div>
            <div className="editor-split__pane editor-split__pane--right">
              <div className="editor-split__strip">
                <span className="editor-split__name" title={splitTab.path}>
                  {splitTab.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("editor.closeSplit")}
                  title={t("editor.closeSplit")}
                  onClick={() => setSplit(null)}
                >
                  <IconX size={14} stroke={1.75} />
                </Button>
              </div>
              <div className="editor-split__editor">
                <Editor
                  height="100%"
                  width="100%"
                  path={splitTab.path}
                  language={splitTab.language}
                  value={splitTab.content}
                  theme={monacoThemeFor(theme)}
                  loading={editorLoading}
                  keepCurrentModel
                  onChange={(value) => updateContent(splitTab.path, value ?? "")}
                  options={EDITOR_OPTIONS}
                />
              </div>
            </div>
          </div>
        ) : (
          primaryEditor
        )}
        {inlineEdit && (
          // A <form> on purpose: `.editor-host > div` is forced to 100% size
          // by global.css, and Enter submitting is free.
          <form
            className="absolute z-30 flex flex-col gap-1.5 rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md"
            style={{
              top: inlineEdit.top,
              left: inlineEdit.left,
              width: INLINE_EDIT_WIDGET_WIDTH,
            }}
            onSubmit={(event) => {
              event.preventDefault();
              void submitInlineEdit();
            }}
          >
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                value={inlineInstruction}
                disabled={inlineEdit.busy}
                placeholder={t("editor.inlineEditPlaceholder")}
                aria-label={t("editor.inlineEdit")}
                className="h-7 text-xs"
                onChange={(event) => setInlineInstruction(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeInlineEdit();
                  }
                }}
              />
              {inlineEdit.busy && <Spinner size="sm" />}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.close")}
                onClick={closeInlineEdit}
              >
                <IconX size={14} stroke={1.75} />
              </Button>
            </div>
            {inlineEdit.busy && (
              <p className="text-xs text-muted-foreground">
                {t("editor.inlineEditBusy")}
              </p>
            )}
            {inlineEdit.error && (
              <p className="text-xs text-destructive">{inlineEdit.error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
