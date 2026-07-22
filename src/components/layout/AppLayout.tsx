import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ActivityBar, type ActivityId } from "./ActivityBar";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { FileTree } from "../sidebar/FileTree";
import { SearchPanel } from "../sidebar/SearchPanel";
import { EditorArea } from "../editor/EditorArea";
import { ChatPanel } from "../chat/ChatPanel";
import { DiffModal } from "../diff/DiffModal";
import { SettingsView } from "../settings/SettingsView";
import { TerminalPanel } from "../terminal/TerminalPanel";
import { Resizer } from "../common/Resizer";
import { useWorkspaceStore } from "../../stores/workspace";
import { useEditorStore } from "../../stores/editor";
import { useAgentStore } from "../../stores/agent";
import { useSettingsStore } from "../../stores/settings";
import { onBeide } from "../../lib/ipc";

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

  const bootstrap = useWorkspaceStore((s) => s.bootstrap);
  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const saveActive = useEditorStore((s) => s.saveActive);
  const reloadPath = useEditorStore((s) => s.reloadPath);
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
        const path = (payload as { path?: string }).path;
        if (typeof path === "string") {
          const tab = useEditorStore.getState().tabs.find((x) => x.path === path);
          if (tab && !tab.dirty) void reloadPath(path);
        }
      }
    });
  }, [refreshTree, reloadPath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveActive();
      }
      if (mod && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setChatOpen(true);
        requestAnimationFrame(() => {
          const el = document.getElementById("chat-composer");
          el?.focus();
        });
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
      if (mod && e.key === "`") {
        e.preventDefault();
        setTermOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveActive]);

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
                    : t("sidebar.explorer")}
                </span>
              </div>
              <div className="sidebar__body">
                {activity === "search" ? <SearchPanel /> : <FileTree />}
              </div>
            </aside>
            <Resizer direction="vertical" onResize={onSidebarResize} />
          </>
        )}

        <div className="app-main">
          <div className="app-center">
            {showSettings ? (
              <SettingsView />
            ) : (
              <EditorArea />
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
    </div>
  );
}
