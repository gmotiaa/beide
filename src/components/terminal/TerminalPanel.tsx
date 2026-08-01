import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { IconTrash, IconX } from "@tabler/icons-react";
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
import { useWorkspaceStore } from "../../stores/workspace";

interface TerminalPanelProps {
  collapsed?: boolean;
  onClose?: () => void;
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
 * Real PTY terminal: @xterm/xterm in the renderer, ConPTY behind
 * `terminal:*` IPC in main. Interactive programs and TUIs work; the shell is
 * the system default (cmd.exe/COMSPEC on Windows).
 *
 * The component stays mounted while collapsed (hidden with display:none) so
 * the shell session and scrollback survive toggling the panel.
 */
export function TerminalPanel({ collapsed, onClose }: TerminalPanelProps) {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const mountRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  /** Set when the shell exited; the next keystroke starts a fresh one. */
  const exitedRef = useRef(false);
  const collapsedRef = useRef(Boolean(collapsed));
  collapsedRef.current = Boolean(collapsed);

  const spawnShell = useCallback(async () => {
    const api = getBeide();
    const term = termRef.current;
    if (!api || !term || ptyIdRef.current) return;
    try {
      fitRef.current?.fit();
      const { id } = await api.terminal.create(term.cols, term.rows);
      ptyIdRef.current = id;
      exitedRef.current = false;
    } catch (e) {
      term.writeln(
        `\r\n\x1b[31m${e instanceof Error ? e.message : String(e)}\x1b[0m`,
      );
    }
  }, []);

  // One terminal per panel lifetime; recreated only when the workspace changes.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !rootPath) return;

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
    termRef.current = term;
    fitRef.current = fit;
    fit.fit();

    term.onData((data) => {
      const api = getBeide();
      if (!api) return;
      if (exitedRef.current) {
        // Shell died — any keystroke starts a new one instead of typing into
        // a dead session.
        term.clear();
        void spawnShell();
        return;
      }
      if (ptyIdRef.current) void api.terminal.write(ptyIdRef.current, data);
    });

    const offData = onBeide("terminal:data", (...args: unknown[]) => {
      const payload = args[0] as { id?: string; data?: string };
      if (payload?.id === ptyIdRef.current && typeof payload.data === "string") {
        term.write(payload.data);
      }
    });
    const offExit = onBeide("terminal:exit", (...args: unknown[]) => {
      const payload = args[0] as { id?: string; exitCode?: number };
      if (payload?.id !== ptyIdRef.current) return;
      ptyIdRef.current = null;
      exitedRef.current = true;
      term.writeln(
        `\r\n\x1b[2m${t("terminal.exited", { code: payload.exitCode ?? 0 })}\x1b[0m`,
      );
    });

    const observer = new ResizeObserver(() => {
      // Fitting a display:none container computes 2×2 cells — skip while hidden.
      if (collapsedRef.current) return;
      fit.fit();
      const api = getBeide();
      if (api && ptyIdRef.current) {
        void api.terminal.resize(ptyIdRef.current, term.cols, term.rows);
      }
    });
    observer.observe(mount);

    void spawnShell();

    return () => {
      observer.disconnect();
      offData();
      offExit();
      const api = getBeide();
      if (api && ptyIdRef.current) void api.terminal.kill(ptyIdRef.current);
      ptyIdRef.current = null;
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // `t` is deliberately not a dependency: re-creating the terminal on a
    // language switch would kill the running shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, spawnShell]);

  // Re-fit and focus when the panel is revealed.
  useEffect(() => {
    if (collapsed) return;
    requestAnimationFrame(() => {
      fitRef.current?.fit();
      const api = getBeide();
      const term = termRef.current;
      if (api && term && ptyIdRef.current) {
        void api.terminal.resize(ptyIdRef.current, term.cols, term.rows);
      }
      termRef.current?.focus();
    });
  }, [collapsed]);

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
                    onClick={() => termRef.current?.clear()}
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
        <div className="terminal-panel__xterm" ref={mountRef} />
      </div>
    </section>
  );
}
