import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button, Chip, CloseButton, Tooltip } from "@heroui/react";
import { IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { getBeide } from "../../lib/ipc";
import { useWorkspaceStore } from "../../stores/workspace";

interface TerminalPanelProps {
  collapsed?: boolean;
  onClose?: () => void;
}

interface TermLine {
  kind: "cmd" | "out" | "err" | "meta";
  text: string;
}

/**
 * Command terminal via window.beide.shell.run (cmd.exe on Windows).
 * Not a full PTY — good enough for npm/git/python one-shots in v0.1.
 */
export function TerminalPanel({ collapsed, onClose }: TerminalPanelProps) {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const [lines, setLines] = useState<TermLine[]>([
    {
      kind: "meta",
      text: "beide terminal — команда + Enter (cwd = workspace)",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines, collapsed]);

  useEffect(() => {
    if (!collapsed) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [collapsed]);

  const run = async (command: string) => {
    const cmd = command.trim();
    if (!cmd || busy) return;

    setHistory((h) => (h[h.length - 1] === cmd ? h : [...h, cmd].slice(-80)));
    setHistIdx(-1);
    setLines((prev) => [...prev, { kind: "cmd", text: `$ ${cmd}` }]);
    setInput("");

    if (!rootPath) {
      setLines((prev) => [
        ...prev,
        { kind: "err", text: t("terminal.noWorkspace") },
      ]);
      return;
    }

    const api = getBeide();
    if (!api) {
      setLines((prev) => [
        ...prev,
        { kind: "err", text: "window.beide.shell unavailable — restart beide" },
      ]);
      return;
    }

    setBusy(true);
    try {
      const result = await api.shell.run(cmd);
      const next: TermLine[] = [];
      if (result.stdout?.trim()) {
        next.push({
          kind: "out",
          text: result.stdout.replace(/\r\n/g, "\n").replace(/\n$/, ""),
        });
      }
      if (result.stderr?.trim()) {
        next.push({
          kind: "err",
          text: result.stderr.replace(/\r\n/g, "\n").replace(/\n$/, ""),
        });
      }
      if (!result.stdout?.trim() && !result.stderr?.trim()) {
        next.push({ kind: "meta", text: "(no output)" });
      }
      next.push({
        kind: "meta",
        text: `${t("terminal.exitCode")}: ${result.code}`,
      });
      setLines((prev) => [...prev, ...next]);
    } catch (e) {
      setLines((prev) => [
        ...prev,
        { kind: "err", text: e instanceof Error ? e.message : String(e) },
      ]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void run(input);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(history[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const next = histIdx + 1;
      if (next >= history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(next);
        setInput(history[next] ?? "");
      }
      return;
    }
    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setLines([]);
    }
  };

  if (collapsed) {
    return null;
  }

  const cwdShort = rootPath
    ? rootPath.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : null;

  return (
    <section className="terminal-panel" aria-label={t("terminal.title")}>
      <div className="terminal-panel__header">
        <div className="terminal-panel__title-row">
          <span className="terminal-panel__title">{t("terminal.title")}</span>
          {cwdShort ? (
            <Chip size="sm" variant="soft" className="terminal-panel__cwd-chip">
              {cwdShort}
            </Chip>
          ) : (
            <Chip size="sm" color="warning" variant="soft">
              no workspace
            </Chip>
          )}
          {busy && (
            <Chip size="sm" color="accent" variant="soft">
              running
            </Chip>
          )}
        </div>
        <div className="terminal-panel__header-actions">
          <Tooltip delay={300}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t("terminal.clear")}
              onPress={() => setLines([])}
            >
              <IconTrash size={16} stroke={1.75} />
            </Button>
            <Tooltip.Content>
              <p>{t("terminal.clear")}</p>
            </Tooltip.Content>
          </Tooltip>
          {onClose && (
            <CloseButton aria-label={t("common.close")} onPress={onClose} />
          )}
        </div>
      </div>
      <div className="terminal-panel__body" ref={scroller}>
        {!rootPath && (
          <div className="term-meta">{t("terminal.noWorkspace")}</div>
        )}
        {lines.map((line, i) => (
          <div
            key={`${i}-${line.kind}`}
            className={
              line.kind === "cmd"
                ? "term-cmd"
                : line.kind === "err"
                  ? "term-err"
                  : line.kind === "meta"
                    ? "term-meta"
                    : "term-out"
            }
          >
            {line.text}
          </div>
        ))}
        {busy && <div className="term-meta">…</div>}
      </div>
      <div className="terminal-panel__input-row">
        <span className="terminal-panel__prompt">›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            rootPath ? t("terminal.placeholder") : t("terminal.noWorkspace")
          }
          disabled={busy || !rootPath}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
        <Button
          size="sm"
          isDisabled={busy || !rootPath || !input.trim()}
          isPending={busy}
          onPress={() => void run(input)}
        >
          <IconPlayerPlay size={14} stroke={2} />
          {t("terminal.run")}
        </Button>
      </div>
    </section>
  );
}
