import { useTranslation } from "react-i18next";
import type { ChatMessage } from "../../lib/types";

interface ToolCardProps {
  message: ChatMessage;
}

export function ToolCard({ message }: ToolCardProps) {
  const { t } = useTranslation();
  const status = message.toolStatus ?? "running";
  const statusLabel =
    status === "running"
      ? t("chat.toolRunning")
      : status === "error"
        ? t("chat.toolError")
        : t("chat.toolDone");

  return (
    <div className="tool-card">
      <div className="tool-card__row">
        <span className="tool-card__name">{message.toolName ?? "tool"}</span>
        <span className={`tool-card__status tool-card__status--${status}`}>
          {statusLabel}
        </span>
      </div>
      {(message.toolDetail || message.content) && (
        <div className="tool-card__detail" title={message.toolDetail || message.content}>
          {message.toolDetail || message.content}
        </div>
      )}
    </div>
  );
}
