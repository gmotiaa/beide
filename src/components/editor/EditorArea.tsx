import { useEffect, useRef, type ReactNode } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  Card,
  Chip,
  CloseButton,
  Kbd,
  Spinner,
  Surface,
} from "@heroui/react";
import { IconFolderOpen, IconMessageChatbot, IconTerminal2 } from "@tabler/icons-react";
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
  return (
    <div className="editor-empty">
      <div className="editor-empty__glow" aria-hidden />
      <Surface className="editor-empty__surface" variant="default">
        <div className="editor-empty__mark" aria-hidden>
          b
        </div>
        <Chip color="accent" size="sm" variant="soft">
          beide · desktop agent IDE
        </Chip>
        <h1 className="editor-empty__title">{title}</h1>
        <p className="editor-empty__body">{body}</p>

        {action && <div className="editor-empty__action">{action}</div>}

        {showShortcuts && (
          <div className="editor-empty__grid">
            <Card className="editor-empty__tip" variant="secondary">
              <Card.Header className="gap-2">
                <div className="editor-empty__tip-icon">
                  <IconFolderOpen size={18} stroke={1.75} />
                </div>
                <Card.Title className="text-sm">Workspace</Card.Title>
                <Card.Description>
                  Открой папку — дерево, поиск и контекст агента.
                </Card.Description>
              </Card.Header>
              <Card.Footer className="gap-2">
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>O</Kbd.Content>
                </Kbd>
              </Card.Footer>
            </Card>

            <Card className="editor-empty__tip" variant="secondary">
              <Card.Header className="gap-2">
                <div className="editor-empty__tip-icon">
                  <IconMessageChatbot size={18} stroke={1.75} />
                </div>
                <Card.Title className="text-sm">Agent chat</Card.Title>
                <Card.Description>
                  Plan исследует. Agent правит с diff / ask.
                </Card.Description>
              </Card.Header>
              <Card.Footer className="gap-2">
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>L</Kbd.Content>
                </Kbd>
              </Card.Footer>
            </Card>

            <Card className="editor-empty__tip" variant="secondary">
              <Card.Header className="gap-2">
                <div className="editor-empty__tip-icon">
                  <IconTerminal2 size={18} stroke={1.75} />
                </div>
                <Card.Title className="text-sm">Terminal</Card.Title>
                <Card.Description>
                  Нижняя панель для shell в корне workspace.
                </Card.Description>
              </Card.Header>
              <Card.Footer className="gap-2">
                <Kbd>
                  <Kbd.Abbr keyValue="ctrl" />
                  <Kbd.Content>`</Kbd.Content>
                </Kbd>
              </Card.Footer>
            </Card>
          </div>
        )}

        <div className="editor-empty__chips">
          <Chip size="sm" variant="soft">
            Monaco
          </Chip>
          <Chip color="accent" size="sm" variant="primary">
            pi + Grok
          </Chip>
          <Chip size="sm" variant="soft">
            Plan / Agent
          </Chip>
        </div>
      </Surface>
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

  useEffect(() => {
    return () => setMonaco(null);
  }, [setMonaco]);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setMonaco(editor);

    monaco.editor.defineTheme("beide-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "5c6168", fontStyle: "italic" },
      ],
      colors: {
        "editor.background": "#0a0b0c",
        "editor.foreground": "#e6e4df",
        "editorLineNumber.foreground": "#5c6168",
        "editorLineNumber.activeForeground": "#8b9098",
        "editor.selectionBackground": "#c8102e33",
        "editor.inactiveSelectionBackground": "#c8102e18",
        "editor.lineHighlightBackground": "#121416",
        "editorCursor.foreground": "#c8102e",
        "editorWidget.background": "#121416",
        "editorWidget.border": "#2a2e33",
        "editorIndentGuide.background": "#1e2226",
        "editorIndentGuide.activeBackground": "#2a2e33",
        "editorGutter.background": "#0a0b0c",
        "editor.selectionHighlightBackground": "#c8102e18",
        "scrollbarSlider.background": "#2a2e3388",
        "scrollbarSlider.hoverBackground": "#3a4048",
      },
    });

    monaco.editor.defineTheme("beide-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#ffffff",
        "editor.foreground": "#111114",
        "editor.selectionBackground": "#5b5bd633",
        "editor.lineHighlightBackground": "#f4f4f8",
        "editorCursor.foreground": "#5b5bd6",
        "editorGutter.background": "#ffffff",
        "editorLineNumber.foreground": "#9b9ba8",
        "editorLineNumber.activeForeground": "#6b6b76",
        "editorIndentGuide.background": "#ececf1",
        "editorWidget.background": "#ffffff",
        "editorWidget.border": "#e4e4e9",
      },
    });

    monaco.editor.defineTheme("beide-midnight", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#060708",
        "editor.foreground": "#e6e4df",
        "editor.selectionBackground": "#c8102e33",
        "editor.lineHighlightBackground": "#0e1012",
        "editorCursor.foreground": "#c8102e",
        "editorGutter.background": "#060708",
        "editorLineNumber.foreground": "#555a62",
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
    <Alert status="danger" className="editor-banner-alert rounded-none border-x-0 border-t-0">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t("common.error")}</Alert.Title>
        <Alert.Description>{lastError}</Alert.Description>
      </Alert.Content>
      <CloseButton aria-label={t("common.close")} onPress={clearError} />
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
              <Button size="lg" onPress={() => void openFolder()}>
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
                <Spinner size="md" />
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
