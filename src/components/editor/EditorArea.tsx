import { useEffect, useRef, type ReactNode } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { TabBar } from "./TabBar";
import { useEditorStore } from "../../stores/editor";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";

interface EditorAreaProps {
  emptyAction?: ReactNode;
}

function monacoThemeFor(theme: string): string {
  if (theme === "light") return "beide-light";
  if (theme === "midnight") return "beide-midnight";
  return "beide-dark";
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
          beide · desktop agent IDE
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
                <CardTitle className="text-sm">Workspace</CardTitle>
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
                <CardTitle className="text-sm">Agent chat</CardTitle>
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
                <CardTitle className="text-sm">Terminal</CardTitle>
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
          <Badge>pi + Grok</Badge>
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

  useEffect(() => {
    return () => setMonaco(null);
  }, [setMonaco]);

  // `keepCurrentModel` deliberately outlives tab switches, which also means a
  // closed tab's model is never reclaimed. Drop models with no tab behind them.
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    const open = new Set(tabs.map((tab) => monaco.Uri.parse(tab.path).toString()));
    for (const model of monaco.editor.getModels()) {
      if (!open.has(model.uri.toString())) model.dispose();
    }
  }, [tabs]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonaco(editor);

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
  };

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const monaco = (window as unknown as { monaco?: { editor: { setTheme: (t: string) => void } } })
      .monaco;
    monaco?.editor.setTheme(monacoThemeFor(theme));
  }, [theme]);

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

  return (
    <div className="editor-area">
      <TabBar />
      {errorBanner}
      <div className="editor-host">
        <Editor
          height="100%"
          width="100%"
          path={active.path}
          language={active.language}
          value={active.content}
          theme={monacoThemeFor(theme)}
          loading={
            <div className="editor-loading">
              <Spinner size="sm" />
              <span>{t("common.loading")}</span>
            </div>
          }
          onMount={onMount}
          keepCurrentModel
          onChange={(value) => {
            if (activePath) updateContent(activePath, value ?? "");
          }}
          options={{
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
          }}
        />
      </div>
    </div>
  );
}
