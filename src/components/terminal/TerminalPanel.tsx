import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getBeide, onBeide } from "../../lib/ipc";
import { registerTerminalSnapshot } from "../../lib/terminal-buffer";
import { useWorkspaceStore } from "../../stores/workspace";

interface TerminalPanelProps {
  collapsed?: boolean;
  onClose?: () => void;
}

/** Mirrors the cap in electron/services/terminal.ts (MAX_TERMINALS). */
const MAX_TABS = 8;

interface TerminalSession {
  id: string;
  term: Terminal;
  fit: FitAddon;
  ptyId: string | null;
  /** Set when the shell exited; the next keystroke starts a fresh one. */
  exited: boolean;
}

/** xterm theme from the app's design tokens, resolved at mount time. */
function themeFromCss(el: HTMLElement) {
  const style = getComputedStyle(el);
  const background = style.getPropertyValue("--background").trim() || "#111113";
  const foreground = style.getPropertyValue("--foreground").trim() || "#e6e6e9";
  return {
    background,
    foreground,
    cursor: foreground,
    selectionBackground: style.getPropertyValue("--primary").trim() || "#4c7dff",
  };
}

/**
 * Real PTY terminals: @xterm/xterm in the renderer, ConPTY behind
 * `terminal:*` IPC in main. Interactive programs and TUIs work; the shell is
 * the system default (cmd.exe/COMSPEC on Windows).
 *
 * The panel manages N independent sessions (tabs). Each session owns its own
 * xterm instance, pty id and mount div; inactive sessions stay mounted with
 * `display:none` so their buffers and running shell survive switching tabs —
 * the same trick used for the whole panel's collapse state.
 */
export function TerminalPanel({ collapsed, onClose }: TerminalPanelProps) {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const hostRef = useRef<HTMLDivElement>(null);
  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map());
  const mountCallbacksRef = useRef<Map<string, (el: HTMLDivElement | null) => void>>(
    new Map(),
  );
  const idCounterRef = useRef(0);
  const [tabOrder, setTabOrder] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const collapsedRef = useRef(Boolean(collapsed));
  collapsedRef.current = Boolean(collapsed);

  const nextId = useCallback(() => `t${++idCounterRef.current}`, []);

  // Expose the active tab's visible tail to the chat composer ("@terminal").
  useEffect(() => {
    registerTerminalSnapshot(() => {
      const id = activeIdRef.current;
      const session = id ? sessionsRef.current.get(id) : undefined;
      if (!session) return "";
      const buffer = session.term.buffer.active;
      const lines: string[] = [];
      const start = Math.max(0, buffer.length - 120);
      for (let i = start; i < buffer.length; i++) {
        lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
      }
      // Trim the trailing run of empty rows the viewport always carries.
      while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
      return lines.slice(-80).join("\n");
    });
    return () => registerTerminalSnapshot(null);
  }, []);

  const spawnShellFor = useCallback(async (session: TerminalSession) => {
    const api = getBeide();
    if (!api || session.ptyId) return;
    try {
      session.fit.fit();
      const { id } = await api.terminal.create(session.term.cols, session.term.rows);
      session.ptyId = id;
      session.exited = false;
    } catch (e) {
      session.term.writeln(
        `\r\n\x1b[31m${e instanceof Error ? e.message : String(e)}\x1b[0m`,
      );
    }
  }, []);

  const initSession = useCallback(
    (id: string, mount: HTMLDivElement) => {
      if (sessionsRef.current.has(id)) return;
      const term = new Terminal({
        fontSize: 13,
        fontFamily:
          '"Cascadia Mono", "JetBrains Mono", Consolas, "Courier New", monospace',
        cursorBlink: true,
        scrollback: 5_000,
        theme: themeFromCss(mount),
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(mount);

      const session: TerminalSession = { id, term, fit, ptyId: null, exited: false };
      sessionsRef.current.set(id, session);
      fit.fit();

      term.onData((data) => {
        const api = getBeide();
        if (!api) return;
        if (session.exited) {
          // Shell died — any keystroke starts a new one instead of typing
          // into a dead session.
          term.clear();
          void spawnShellFor(session);
          return;
        }
        if (session.ptyId) void api.terminal.write(session.ptyId, data);
      });

      void spawnShellFor(session);
    },
    [spawnShellFor],
  );

  const getMountCallback = useCallback(
    (id: string) => {
      let fn = mountCallbacksRef.current.get(id);
      if (!fn) {
        fn = (el) => {
          if (el) initSession(id, el);
        };
        mountCallbacksRef.current.set(id, fn);
      }
      return fn;
    },
    [initSession],
  );

  // One set of sessions per workspace lifetime; torn down and replaced with a
  // single fresh tab whenever the workspace changes (or closes).
  useEffect(() => {
    if (!rootPath) {
      setTabOrder([]);
      setActiveId(null);
      return;
    }
    const id = nextId();
    setTabOrder([id]);
    setActiveId(id);
    return () => {
      const api = getBeide();
      for (const session of sessionsRef.current.values()) {
        if (api && session.ptyId) void api.terminal.kill(session.ptyId);
        session.term.dispose();
      }
      sessionsRef.current.clear();
      mountCallbacksRef.current.clear();
    };
  }, [rootPath, nextId]);

  // Global push-event listeners, shared by every session — each event is
  // routed to the session whose pty id matches.
  useEffect(() => {
    const offData = onBeide("terminal:data", (...args: unknown[]) => {
      const payload = args[0] as { id?: string; data?: string };
      if (typeof payload?.data !== "string") return;
      for (const session of sessionsRef.current.values()) {
        if (session.ptyId === payload.id) {
          session.term.write(payload.data);
          break;
        }
      }
    });
    const offExit = onBeide("terminal:exit", (...args: unknown[]) => {
      const payload = args[0] as { id?: string; exitCode?: number };
      for (const session of sessionsRef.current.values()) {
        if (session.ptyId === payload?.id) {
          session.ptyId = null;
          session.exited = true;
          session.term.writeln(
            `\r\n\x1b[2m${t("terminal.exited", { code: payload?.exitCode ?? 0 })}\x1b[0m`,
          );
          break;
        }
      }
    });
    return () => {
      offData();
      offExit();
    };
  }, [t]);

  // Re-fit and focus whenever the active tab changes or the panel is revealed.
  useEffect(() => {
    if (!activeId || collapsed) return;
    const session = sessionsRef.current.get(activeId);
    if (!session) return;
    requestAnimationFrame(() => {
      session.fit.fit();
      const api = getBeide();
      if (api && session.ptyId) {
        void api.terminal.resize(session.ptyId, session.term.cols, session.term.rows);
      }
      session.term.focus();
    });
  }, [activeId, collapsed]);

  // One ResizeObserver on the always-mounted host; it refits whichever
  // session is currently active (others are display:none and their size is
  // meaningless — same reason we skip fitting while collapsed).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      if (collapsedRef.current) return;
      const id = activeIdRef.current;
      const session = id ? sessionsRef.current.get(id) : undefined;
      if (!session) return;
      session.fit.fit();
      const api = getBeide();
      if (api && session.ptyId) {
        void api.terminal.resize(session.ptyId, session.term.cols, session.term.rows);
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const addTab = useCallback(() => {
    if (!rootPath || tabOrder.length >= MAX_TABS) return;
    const id = nextId();
    setTabOrder((ids) => [...ids, id]);
    setActiveId(id);
  }, [rootPath, tabOrder.length, nextId]);

  const closeTab = useCallback(
    (id: string) => {
      const session = sessionsRef.current.get(id);
      if (session) {
        const api = getBeide();
        if (api && session.ptyId) void api.terminal.kill(session.ptyId);
        session.term.dispose();
        sessionsRef.current.delete(id);
      }
      mountCallbacksRef.current.delete(id);

      const idx = tabOrder.indexOf(id);
      const rest = tabOrder.filter((x) => x !== id);
      if (rest.length === 0) {
        // Always keep at least one tab around.
        const freshId = nextId();
        setTabOrder([freshId]);
        setActiveId(freshId);
        return;
      }
      setTabOrder(rest);
      if (activeId === id) {
        const neighborIdx = Math.min(idx, rest.length - 1);
        setActiveId(rest[neighborIdx]);
      }
    },
    [tabOrder, activeId, nextId],
  );

  const cwdShort = rootPath
    ? rootPath.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : null;

  return (
    <section
      className="terminal-panel"
      aria-label={t("terminal.title")}
      style={collapsed ? { display: "none" } : undefined}
    >
      <div className="terminal-panel__header">
        <div className="terminal-panel__title-row">
          <span className="terminal-panel__title">{t("terminal.title")}</span>
          {tabOrder.length > 0 && (
            <div className="terminal-panel__tabs" role="tablist">
              {tabOrder.map((id, index) => {
                const active = id === activeId;
                const label = String(index + 1);
                return (
                  <div
                    key={id}
                    className={`terminal-panel__tab${active ? " is-active" : ""}`}
                    role="tab"
                    aria-selected={active}
                    aria-label={`${t("terminal.title")} ${label}`}
                    tabIndex={0}
                    onClick={() => setActiveId(id)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveId(id);
                      }
                    }}
                    onMouseDown={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        closeTab(id);
                      }
                    }}
                  >
                    <span className="terminal-panel__tab-label">{label}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("terminal.closeTab")}
                      className="terminal-panel__tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(id);
                      }}
                    >
                      <IconX className="size-3" stroke={2} />
                    </Button>
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("terminal.newTab")}
                className="terminal-panel__tab-add"
                disabled={!rootPath || tabOrder.length >= MAX_TABS}
                onClick={addTab}
              >
                <IconPlus className="size-3.5" stroke={2} />
              </Button>
            </div>
          )}
          {cwdShort ? (
            <Badge variant="secondary" className="terminal-panel__cwd-chip">
              {cwdShort}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="border-transparent bg-[color:var(--warning-muted)] text-[color:var(--warning)]"
            >
              {t("status.noWorkspace")}
            </Badge>
          )}
        </div>
        <div className="terminal-panel__header-actions">
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("terminal.clear")}
                    onClick={() => {
                      if (activeId) sessionsRef.current.get(activeId)?.term.clear();
                    }}
                  />
                }
              >
                <IconTrash size={16} stroke={1.75} />
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("terminal.clear")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <IconX size={16} stroke={1.75} />
            </Button>
          )}
        </div>
      </div>
      <div className="terminal-panel__body terminal-panel__body--pty">
        {!rootPath && (
          <div className="term-meta">{t("terminal.noWorkspace")}</div>
        )}
        <div className="terminal-panel__xterm" ref={hostRef}>
          {tabOrder.map((id) => (
            <div
              key={id}
              className="terminal-panel__xterm-pane"
              ref={getMountCallback(id)}
              style={{ display: id === activeId ? undefined : "none" }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
