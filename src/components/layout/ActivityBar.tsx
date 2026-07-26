import { useTranslation } from "react-i18next";
import { Icons } from "../common/IconButton";

export type ActivityId = "files" | "search" | "settings";

interface ActivityBarProps {
  active: ActivityId;
  onChange: (id: ActivityId) => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  chatOpen: boolean;
  onToggleChat: () => void;
}

export function ActivityBar({
  active,
  onChange,
  terminalOpen,
  onToggleTerminal,
  chatOpen,
  onToggleChat,
}: ActivityBarProps) {
  const { t } = useTranslation();

  // The shortcuts exist in AppLayout but were invisible; the rail is where a
  // user looks for them. Windows-first, same as the editor welcome cards.
  const hint = (label: string, keys: string) => `${label} · ${keys}`;

  return (
    <nav className="activity-bar" aria-label="Activity">
      <button
        type="button"
        className={`activity-btn${active === "files" ? " is-active" : ""}`}
        title={hint(t("activity.files"), "Ctrl+B")}
        aria-label={t("activity.files")}
        aria-pressed={active === "files"}
        onClick={() => onChange("files")}
      >
        {Icons.files}
      </button>
      <button
        type="button"
        className={`activity-btn${active === "search" ? " is-active" : ""}`}
        title={t("activity.search")}
        aria-label={t("activity.search")}
        aria-pressed={active === "search"}
        onClick={() => onChange("search")}
      >
        {Icons.search}
      </button>
      <button
        type="button"
        className={`activity-btn${active === "settings" ? " is-active" : ""}`}
        title={t("activity.settings")}
        aria-label={t("activity.settings")}
        aria-pressed={active === "settings"}
        onClick={() => onChange("settings")}
      >
        {Icons.settings}
      </button>

      <div className="activity-bar__spacer" />

      <button
        type="button"
        className={`activity-btn${terminalOpen ? " is-active" : ""}`}
        title={hint(t("activity.toggleTerminal"), "Ctrl+`")}
        aria-label={t("activity.toggleTerminal")}
        aria-pressed={terminalOpen}
        onClick={onToggleTerminal}
      >
        {Icons.terminal}
      </button>
      <button
        type="button"
        className={`activity-btn${chatOpen ? " is-active" : ""}`}
        title={hint(t("activity.toggleChat"), "Ctrl+L")}
        aria-label={t("activity.toggleChat")}
        aria-pressed={chatOpen}
        onClick={onToggleChat}
      >
        {Icons.chat}
      </button>
    </nav>
  );
}
