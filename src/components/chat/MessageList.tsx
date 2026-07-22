import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chat";
import { MessageItem } from "./MessageItem";

export function MessageList() {
  const { t } = useTranslation();
  const messages = useChatStore((s) => s.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="chat-messages">
        <div className="chat-empty">
          <h3>{t("chat.emptyTitle")}</h3>
          <p>{t("chat.emptyBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-messages">
      {messages.map((m) => (
        <MessageItem key={m.id} message={m} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
