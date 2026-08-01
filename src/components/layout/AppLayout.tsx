import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
} from "react";
import { useTranslation } from "react-i18next";
import { ActivityBar, type ActivityId } from "./ActivityBar";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { FileTree } from "../sidebar/FileTree";
import { SearchPanel } from "../sidebar/SearchPanel";
import { GitPanel } from "../git/GitPanel";
import { ChatPanel } from "../chat/ChatPanel";
import { DiffModal } from "../diff/DiffModal";
import { SettingsView } from "../settings/SettingsView";
import { PreviewPanel } from "../preview/PreviewPanel";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { Resizer } from "../common/Resizer";
import { useWorkspaceStore } from "../../stores/workspace";
import { useEditorStore } from "../../stores/editor";
import { useAgentStore } from "../../stores/agent";
import { useSettingsStore } from "../../stores/settings";
import { useChatStore } from "../../stores/chat";
import { getBeide, onBeide } from "../../lib/ipc";

// Monaco dominates the renderer bundle (~8 of 11 MB) — split it off the
// startup path; the shell paints immediately and the editor streams in.
const EditorArea = lazy(() =>
  import("../editor/EditorArea").then((m) => ({ default: m.EditorArea })),
);

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const CHAT_MIN = 280;
const CHAT_MAX = 640;
const TERM_MIN = 100;
const TERM_MAX = 480;

export function AppLayout() {
  const { t } = useTranslation();
  const [activity, setActivity] = useState<ActivityId>("files");
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [chatWidth, setChatWidth] = useState(360);
  const [termHeight, setTermHeight] = useState(180);
  const [chatOpen, setChatOpen] = useState(true);
  const [termOpen, setTermOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const bootstrap = useWorkspaceStore((s) => s.bootstrap);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const saveActive = useEditorStore((s) => s.saveActive);
  const reloadPath = useEditorStore((s) => s.reloadPath);
  const hasDirtyTabs = useEditorStore((s) => s.tabs.some((tab) => tab.dirty));
  const agentInit = useAgentStore((s) => s.init);
  const agentDispose = useAgentStore((s) => s.dispose);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    void loadSettings();
    void bootstrap();
    agentInit();
    return () => agentDispose();
  }, [loadSettings, bootstrap, agentInit, agentDispose]);

  useEffect(() => {
    return onBeide("workspace:changed", (...args: unknown[]) => {
      void refreshTree();
      const payload = args[0];
      if (payload && typeof payload === "object") {
        const change = payload as {
          path?: string;
          paths?: string[];
          restored?: string;
        };
        if (typeof change.restored === "string" && Array.isArray(change.paths)) {
          for (const restoredPath of change.paths) {
            if (typeof restoredPath === "string") {
              void reloadPath(restoredPath, true);
            }
          }
          return;
        }
        const path = change.path;
        if (typeof path === "string") {
          const tab = useEditorStore.getState().tabs.find((x) => x.path === path);
          if (tab && !tab.dirty) void reloadPath(path);
        }
      }
    });
  }, [refreshTree, reloadPath]);

  useEffect(() => {
    void getBeide()?.window.setDirty(hasDirtyTabs);
  }, [hasDirtyTabs]);

  useEffect(() => {
    let closing = false;
    return onBeide("window:close-requested", (...args: unknown[]) => {
      if (closing) return;
      const payload = args[0];
      const dirty =
        payload && typeof payload === "object" && "dirty" in payload
          ? Boolean((payload as { dirty?: unknown }).dirty)
          : useEditorStore.getState().tabs.some((tab) => tab.dirty);
      if (dirty && !window.confirm(t("editor.closeWindowUnsavedConfirm"))) return;

      closing = true;
      void (async () => {
        try {
          // Persist the latest assistant/tool deltas while the workspace and
          // renderer still exist, then allow exactly this close attempt.
          await useChatStore.getState().flushBeforeWorkspaceChange();
          await getBeide()?.window.close(true);
        } catch {
          closing = false;
        }
      })();
    });
  }, [t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // `e.key` follows the OS layout: on ЙЦУКЕН Ctrl+S arrives as "ы" and
      // none of the shortcuts fire. Match the physical key (`e.code`) as well
      // so they work on Cyrillic layouts too.
      const is = (letter: string, code: string) =>
        e.key.toLowerCase() === letter || e.code === code;
      // Ctrl/Cmd+Shift+P: command palette. preventDefault before anything
      // else so the devtools shortcut never wins over the palette.
      if (e.shiftKey && is("p", "KeyP")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (is("s", "KeyS")) {
        e.preventDefault();
        void saveActive();
      }
      // TitleBar's menu and the editor welcome cards advertise Ctrl+O; the
      // handler has to actually exist for that promise to hold.
      if (is("o", "KeyO")) {
        e.preventDefault();
        void openFolder();
      }
      if (is("l", "KeyL")) {
        e.preventDefault();
        setChatOpen(true);
        requestAnimationFrame(() => {
          const el = document.getElementById("chat-composer");
          el?.focus();
        });
      }
      if (is("b", "KeyB")) {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
      if (e.key === "`" || e.code === "Backquote") {
        e.preventDefault();
        setTermOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveActive, openFolder]);

  const onSidebarResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w + delta)));
  }, []);

  const onChatResize = useCallback((delta: number) => {
    setChatWidth((w) => Math.min(CHAT_MAX, Math.max(CHAT_MIN, w - delta)));
  }, []);

  const onTermResize = useCallback((delta: number) => {
    setTermHeight((h) => Math.min(TERM_MAX, Math.max(TERM_MIN, h - delta)));
  }, []);

  const handleActivity = (id: ActivityId) => {
    if (id === activity && sidebarOpen) {
      setSidebarOpen(false);
      return;
    }
    setActivity(id);
    setSidebarOpen(true);
  };

  const showSettings = activity === "settings";
  const showPreview = activity === "preview";

  return (
    <div
      className="app-root"
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
          "--chat-width": `${chatWidth}px`,
          "--terminal-height": `${termHeight}px`,
        } as CSSProperties
      }
    >
      <TitleBar />
      <div className="app-body">
        <ActivityBar
          active={activity}
          onChange={handleActivity}
          terminalOpen={termOpen}
          onToggleTerminal={() => setTermOpen((v) => !v)}
          chatOpen={chatOpen}
          onToggleChat={() => setChatOpen((v) => !v)}
        />

        {sidebarOpen && (
          <>
            <aside className="sidebar" aria-label={t("common.files")}>
              <div className="sidebar__header">
                <span>
                  {activity === "search"
                    ? t("sidebar.searchFiles")
                    : activity === "git"
                      ? t("git.title")
                      : t("sidebar.explorer")}
                </span>
              </div>
              <div className="sidebar__body">
                {activity === "search" ? (
                  <SearchPanel />
                ) : activity === "git" ? (
                  <GitPanel />
                ) : (
                  <FileTree />
                )}
              </div>
            </aside>
            <Resizer direction="vertical" onResize={onSidebarResize} />
          </>
        )}

        <div className="app-main">
          <div className="app-center">
            {showSettings ? (
              <SettingsView />
            ) : showPreview ? (
              <PreviewPanel />
            ) : (
              <Suspense fallback={<div className="app-boot" />}>
                <EditorArea />
              </Suspense>
            )}

            {chatOpen && (
              <>
                <Resizer direction="vertical" onResize={onChatResize} />
                <ChatPanel />
              </>
            )}
          </div>

          {termOpen && (
            <>
              <Resizer direction="horizontal" onResize={onTermResize} />
              <TerminalPanel onClose={() => setTermOpen(false)} />
            </>
          )}
        </div>
      </div>
      <StatusBar />
      <DiffModal />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleTerminal={() => setTermOpen((v) => !v)}
        onToggleChat={() => setChatOpen((v) => !v)}
        onOpenChat={() => setChatOpen(true)}
        onShowActivity={(id) => {
          setActivity(id);
          setSidebarOpen(true);
        }}
      />
    </div>
  );
}
