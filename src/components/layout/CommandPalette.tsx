import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { ActivityId } from "./ActivityBar";
import { useWorkspaceStore } from "../../stores/workspace";
import { useEditorStore } from "../../stores/editor";
import { useAgentStore } from "../../stores/agent";
import { useSettingsStore } from "../../stores/settings";
import { useChatStore } from "../../stores/chat";

const FILE_RESULT_LIMIT = 15;
const FILE_SEARCH_MIN_CHARS = 2;
const FILE_SEARCH_DEBOUNCE_MS = 150;

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleSidebar: () => void;
  onToggleTerminal: () => void;
  onToggleChat: () => void;
  /** Ensures the chat panel is visible (does not toggle it off). */
  onOpenChat: () => void;
  /** Selects an activity view (files / search / git / settings). */
  onShowActivity: (id: ActivityId) => void;
}

interface CommandItem {
  kind: "command";
  id: string;
  label: string;
  run: () => void;
}

interface FileItem {
  kind: "file";
  id: string;
  path: string;
}

type PaletteItem = CommandItem | FileItem;

/**
 * Case-insensitive match: 2 = substring (ranks higher), 1 = subsequence,
 * 0 = no match. An empty query matches everything.
 */
function matchScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 2;
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

export function CommandPalette({
  open,
  onClose,
  onToggleSidebar,
  onToggleTerminal,
  onToggleChat,
  onOpenChat,
  onShowActivity,
}: CommandPaletteProps) {
  const { t } = useTranslation();
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const searchFiles = useWorkspaceStore((s) => s.searchFiles);
  const saveActive = useEditorStore((s) => s.saveActive);
  const openFile = useEditorStore((s) => s.openFile);
  const setMode = useAgentStore((s) => s.setMode);
  const updateSettings = useSettingsStore((s) => s.update);
  const newSession = useChatStore((s) => s.newSession);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commandsOnly = query.startsWith(">");
  const needle = (commandsOnly ? query.slice(1) : query).trim();

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        kind: "command",
        id: "openFolder",
        label: t("palette.openFolder"),
        run: () => void openFolder(),
      },
      {
        kind: "command",
        id: "saveActive",
        label: t("palette.saveActive"),
        run: () => void saveActive(),
      },
      {
        kind: "command",
        id: "toggleSidebar",
        label: t("palette.toggleSidebar"),
        run: onToggleSidebar,
      },
      {
        kind: "command",
        id: "toggleTerminal",
        label: t("palette.toggleTerminal"),
        run: onToggleTerminal,
      },
      {
        kind: "command",
        id: "toggleChat",
        label: t("palette.toggleChat"),
        run: onToggleChat,
      },
      {
        kind: "command",
        id: "focusChat",
        label: t("palette.focusChat"),
        run: () => {
          onOpenChat();
          requestAnimationFrame(() => {
            document.getElementById("chat-composer")?.focus();
          });
        },
      },
      {
        kind: "command",
        id: "newChat",
        label: t("palette.newChat"),
        run: () => void newSession(),
      },
      {
        kind: "command",
        id: "modePlan",
        label: t("palette.modePlan"),
        run: () => void setMode("plan"),
      },
      {
        kind: "command",
        id: "modeAgent",
        label: t("palette.modeAgent"),
        run: () => void setMode("agent"),
      },
      {
        kind: "command",
        id: "themeLight",
        label: t("palette.themeLight"),
        run: () => void updateSettings({ theme: "light" }),
      },
      {
        kind: "command",
        id: "themeDark",
        label: t("palette.themeDark"),
        run: () => void updateSettings({ theme: "dark" }),
      },
      {
        kind: "command",
        id: "themeMidnight",
        label: t("palette.themeMidnight"),
        run: () => void updateSettings({ theme: "midnight" }),
      },
      {
        kind: "command",
        id: "openSettings",
        label: t("palette.openSettings"),
        run: () => onShowActivity("settings"),
      },
      {
        kind: "command",
        id: "showGit",
        label: t("palette.showGit"),
        run: () => onShowActivity("git"),
      },
      {
        kind: "command",
        id: "showFiles",
        label: t("palette.showFiles"),
        run: () => onShowActivity("files"),
      },
      {
        kind: "command",
        id: "showSearch",
        label: t("palette.showSearch"),
        run: () => onShowActivity("search"),
      },
    ],
    [
      t,
      openFolder,
      saveActive,
      onToggleSidebar,
      onToggleTerminal,
      onToggleChat,
      onOpenChat,
      onShowActivity,
      newSession,
      setMode,
      updateSettings,
    ],
  );

  // Reset state on every open so the palette never shows a stale query.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setFiles([]);
    setSelected(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced file search (mixed mode only, 2+ chars).
  useEffect(() => {
    if (!open || commandsOnly || needle.length < FILE_SEARCH_MIN_CHARS) {
      setFiles([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      searchFiles(needle).then(
        (paths) => {
          if (!cancelled) setFiles(paths.slice(0, FILE_RESULT_LIMIT));
        },
        () => {
          if (!cancelled) setFiles([]);
        },
      );
    }, FILE_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, commandsOnly, needle, searchFiles]);

  const items = useMemo<PaletteItem[]>(() => {
    const matched = commands
      .map((cmd, index) => ({ cmd, index, score: matchScore(needle, cmd.label) }))
      .filter((x) => x.score > 0)
      // Substring matches above subsequence matches, otherwise stable order.
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.cmd);
    if (commandsOnly) return matched;
    const fileItems: FileItem[] = files.map((path) => ({
      kind: "file",
      id: `file:${path}`,
      path,
    }));
    return [...matched, ...fileItems];
  }, [commands, needle, commandsOnly, files]);

  // Keep the highlight inside the list when results shrink or change.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, items.length - 1)));
  }, [items]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [selected, items]);

  if (!open) return null;

  const runItem = (item: PaletteItem) => {
    onClose();
    if (item.kind === "file") {
      void openFile(item.path);
      return;
    }
    item.run();
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[selected];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="palette-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="palette" role="dialog" aria-label={t("palette.title")}>
        <input
          ref={inputRef}
          className="palette__input"
          type="text"
          value={query}
          spellCheck={false}
          autoComplete="off"
          placeholder={t("palette.placeholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={onInputKeyDown}
        />
        <div className="palette__list" ref={listRef} role="listbox">
          {items.length === 0 && (
            <div className="palette__empty">{t("palette.noResults")}</div>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === selected}
              data-selected={index === selected ? "true" : undefined}
              className={
                index === selected
                  ? "palette__item palette__item--selected"
                  : "palette__item"
              }
              title={item.kind === "file" ? item.path : undefined}
              onMouseEnter={() => setSelected(index)}
              onClick={() => runItem(item)}
            >
              {item.kind === "command" ? (
                <span className="palette__label">{item.label}</span>
              ) : (
                <span className="palette__path">{item.path}</span>
              )}
            </button>
          ))}
        </div>
        <div className="palette__footer">
          <span>
            <kbd>↑↓</kbd> {t("palette.hintNavigate")}
          </span>
          <span>
            <kbd>Enter</kbd> {t("palette.hintRun")}
          </span>
          <span>
            <kbd>Esc</kbd> {t("palette.hintClose")}
          </span>
        </div>
      </div>
    </div>
  );
}
