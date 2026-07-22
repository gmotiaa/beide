import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../lib/types";
import { ToolCard } from "./ToolCard";
import { fileNameFromPath } from "../../lib/language";

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  if (message.role === "tool") {
    return <ToolCard message={message} />;
  }

  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const roleClass = isUser ? "msg--user" : isSystem ? "msg--system" : "msg--assistant";
  const label = isUser ? "You" : isSystem ? "System" : "beide";
  const initial = isUser ? "U" : isSystem ? "S" : "b";

  return (
    <article className={`msg ${roleClass}`}>
      <div className="msg__head">
        <span className="msg__avatar" aria-hidden>{initial}</span>
        <span className="msg__role">{label}</span>
      </div>
      <div className="msg__bubble">
        {!isUser && (
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || ""}
            </ReactMarkdown>
            {message.streaming && <span className="streaming-caret" />}
          </div>
        )}
        {isUser && <div className="msg__text">{message.content}</div>}

        {message.mentions && message.mentions.length > 0 && (
          <div className="msg__mentions">
            {message.mentions.map((m) => (
              <span key={m.path} className="mention-chip" title={m.path}>
                @{m.name || fileNameFromPath(m.path)}
              </span>
            ))}
          </div>
        )}

        {message.images && message.images.length > 0 && (
          <div className="msg__images">
            {message.images.map((img, i) => (
              <img
                key={`${message.id}_${i}`}
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.name ?? "attachment"}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
