import { useTranslation } from "react-i18next";
import { Icons } from "../common/IconButton";

export type ActivityId = "files" | "search" | "git" | "settings";

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

  return (
    <nav className="activity-bar" aria-label="Activity">
      <button
        type="button"
        className={`activity-btn${active === "files" ? " is-active" : ""}`}
        title={t("activity.files")}
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
        className={`activity-btn${active === "git" ? " is-active" : ""}`}
        title={t("git.title")}
        aria-label={t("git.title")}
        aria-pressed={active === "git"}
        onClick={() => onChange("git")}
      >
        {Icons.sourceControl}
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
        title={t("activity.toggleTerminal")}
        aria-label={t("activity.toggleTerminal")}
        aria-pressed={terminalOpen}
        onClick={onToggleTerminal}
      >
        {Icons.terminal}
      </button>
      <button
        type="button"
        className={`activity-btn${chatOpen ? " is-active" : ""}`}
        title={t("activity.toggleChat")}
        aria-label={t("activity.toggleChat")}
        aria-pressed={chatOpen}
        onClick={onToggleChat}
      >
        {Icons.chat}
      </button>
    </nav>
  );
}
