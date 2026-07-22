import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatStatus, UIMessage } from "ai";
import {
  IconBulb,
  IconCode,
  IconFolder,
  IconPlus,
  IconRobot,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";

import { MessageList } from "../agent-elements/message-list";
import { InputBar } from "../agent-elements/input-bar";
import { ModeSelector } from "../agent-elements/input/mode-selector";
import { Suggestions, type SuggestionItem } from "../agent-elements/input/suggestions";
import { ErrorMessage } from "../agent-elements/error-message";
import { TextShimmer } from "../agent-elements/text-shimmer";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { ChatHistory } from "./ChatHistory";

import { useAgentStore } from "../../stores/agent";
import { useChatStore } from "../../stores/chat";
import { toUIMessages } from "../../lib/to-ui-messages";
import type { AgentMode, ChatImage } from "../../lib/types";
import { cn } from "../../lib/utils";

const MODES = [
  {
    id: "agent",
    label: "Агент",
    icon: IconRobot,
    description: "Читать, править, bash",
  },
  {
    id: "plan",
    label: "План",
    icon: IconBulb,
    description: "Только план, без правок",
  },
];

/** Подсказки только над инпутом, когда лента пуста */
const SUGGESTIONS_RU: SuggestionItem[] = [
  {
    id: "map",
    label: "Карта проекта",
    value: "Покажи структуру проекта: ключевые модули и точки входа.",
    icon: <IconFolder className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: "risks",
    label: "Найти риски",
    value: "Найди рискованные места и баги. Отсортируй по серьёзности.",
    icon: <IconSearch className="h-3.5 w-3.5" aria-hidden />,
  },
  {
    id: "code",
    label: "Разобрать код",
    value: "Прочитай открытый файл и кратко опиши назначение и проблемы.",
    icon: <IconCode className="h-3.5 w-3.5" aria-hidden />,
  },
];

function fileToChatImage(file: File): Promise<ChatImage | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const data = comma >= 0 ? result.slice(comma + 1) : result;
      resolve({
        mimeType: file.type || "image/png",
        data,
        name: file.name,
      });
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function modelShortName(model?: string): string | null {
  if (!model) return null;
  return model.includes("/") ? (model.split("/").pop() ?? model) : model;
}

export function ChatPanel() {
  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);
  const streaming = useAgentStore((s) => s.streaming);
  const ready = useAgentStore((s) => s.ready);
  const model = useAgentStore((s) => s.model);
  const send = useAgentStore((s) => s.send);
  const abort = useAgentStore((s) => s.abort);

  const messages = useChatStore((s) => s.messages);
  const error = useChatStore((s) => s.error);
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const images = useChatStore((s) => s.images);
  const addImage = useChatStore((s) => s.addImage);
  const removeImage = useChatStore((s) => s.removeImage);
  const newSession = useChatStore((s) => s.newSession);
  const setError = useChatStore((s) => s.setError);
  const refreshSessions = useChatStore((s) => s.refreshSessions);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions, ready]);

  const uiMessages = useMemo(() => toUIMessages(messages), [messages]);
  const modelLabel = modelShortName(model);

  const status: ChatStatus = streaming
    ? "streaming"
    : error
      ? "error"
      : "ready";

  const listMessages: UIMessage[] = useMemo(() => {
    if (!error) return uiMessages;
    return [
      ...uiMessages,
      {
        id: "beide-error",
        role: "assistant",
        parts: [
          {
            type: "error",
            title: "Ошибка запроса",
            message: error,
          } as unknown as UIMessage["parts"][number],
        ],
      },
    ];
  }, [uiMessages, error]);

  const attachedImages = useMemo(
    () =>
      images.map((img, i) => ({
        id: `img-${i}`,
        filename: img.name ?? `изображение-${i + 1}`,
        url: `data:${img.mimeType};base64,${img.data}`,
      })),
    [images],
  );

  const onSend = useCallback(
    ({ content }: { role?: string; content: string }) => {
      if (!ready) {
        setError("Сначала откройте папку проекта");
        return;
      }
      const text = (content ?? "").trim();
      if (!text && images.length === 0) return;
      void send(text);
      setDraft("");
    },
    [ready, send, setError, setDraft, images.length],
  );

  const onStop = useCallback(() => {
    void abort();
  }, [abort]);

  const onAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesPicked = useCallback(
    async (list: FileList | null) => {
      if (!list) return;
      for (const file of Array.from(list)) {
        const img = await fileToChatImage(file);
        if (img) addImage(img);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addImage],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            void fileToChatImage(file).then((img) => img && addImage(img));
          }
        }
      }
    },
    [addImage],
  );

  const onSuggestion = useCallback(
    (item: SuggestionItem) => {
      const value = item.value ?? item.label;
      setDraft(value);
    },
    [setDraft],
  );

  const showInlineSuggestions = messages.length === 0 && !streaming;

  return (
    <TooltipProvider delay={200}>
      <aside
        className={cn(
          "chat-panel chat-panel--ae",
          isDragOver && "chat-panel--drag",
        )}
        data-mode={mode}
        data-streaming={streaming ? "1" : "0"}
        data-ready={ready ? "1" : "0"}
        aria-label="Чат агента"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          void onFilesPicked(e.dataTransfer.files);
        }}
      >
        <div className="chat-panel__header">
          <div className="chat-panel__title-row">
            <span
              className={cn(
                "chat-panel__status-dot",
                ready ? "is-ready" : "is-idle",
                streaming && "is-live",
              )}
              aria-hidden
            />
            <span className="chat-panel__title">
              {mode === "plan" ? "План" : "Агент"}
            </span>
            {modelLabel && (
              <Badge
                variant="outline"
                className="chat-panel__model-badge max-w-[9rem] truncate font-mono text-[10.5px] font-normal"
                title={model}
              >
                {modelLabel}
              </Badge>
            )}
            {streaming && (
              <Badge
                variant="secondary"
                className="chat-panel__live-badge gap-1 border-transparent px-2 font-normal"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                <TextShimmer as="span" duration={1.2} spread={60}>
                  работает
                </TextShimmer>
              </Badge>
            )}
          </div>

          <div className="chat-panel__header-actions">
            <ChatHistory />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="chat-panel__new"
                    aria-label="Новый чат"
                    onClick={() => {
                      void newSession();
                      setError(null);
                    }}
                  >
                    <IconPlus className="size-4" stroke={1.5} />
                  </Button>
                }
              />
              <TooltipContent side="bottom">Новый чат</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Separator className="opacity-60" />

        <div className="chat-panel__body">
          <div className="chat-panel__scroll">
            {messages.length === 0 && !error ? (
              <div className="chat-panel__empty">
                <div className="chat-panel__empty-icon" aria-hidden>
                  <IconSparkles className="size-5" stroke={1.5} />
                </div>
                <div className="chat-panel__empty-title">beide</div>
                <p className="chat-panel__empty-body">
                  {ready
                    ? "Опишите задачу — агент сам читает файлы проекта и вносит правки."
                    : "Откройте папку проекта, чтобы начать работу с агентом."}
                </p>
                {!ready && (
                  <Badge variant="outline" className="mt-1 font-normal">
                    workspace не открыт
                  </Badge>
                )}
              </div>
            ) : (
              <MessageList
                messages={listMessages}
                status={status}
                showCopyToolbar
                enableImagePreview
                className="chat-panel__messages"
              />
            )}

            {error && messages.length === 0 && (
              <div className="px-3 pb-2">
                <ErrorMessage title="Ошибка" message={error} />
              </div>
            )}
          </div>

          <div className="chat-panel__composer">
            {showInlineSuggestions && (
              <Suggestions
                items={SUGGESTIONS_RU}
                onSelect={onSuggestion}
                disabled={!ready || streaming}
                className="chat-panel__suggestions"
                itemClassName="h-8 rounded-lg px-3 text-sm"
              />
            )}

            <InputBar
              onSend={onSend}
              status={status}
              onStop={onStop}
              value={draft}
              onChange={setDraft}
              placeholder={
                ready
                  ? "Сообщение агенту beide…"
                  : "Сначала откройте папку проекта"
              }
              disabled={!ready}
              onAttach={onAttach}
              attachedImages={attachedImages}
              onRemoveImage={(id) => {
                const idx = Number(String(id).replace("img-", ""));
                if (!Number.isNaN(idx)) removeImage(idx);
              }}
              onPaste={onPaste}
              isDragOver={isDragOver}
              enableImagePreview
              leftActions={
                <ModeSelector
                  modes={MODES}
                  value={mode}
                  onChange={(id) => void setMode(id as AgentMode)}
                />
              }
              className="beide-agent-input"
            />
          </div>
        </div>

        <div className="chat-panel__footer">
          <Badge
            variant="outline"
            className="chat-panel__ai-badge h-[18px] min-w-7 rounded-[5px] px-1.5 text-[10px] font-bold tracking-wider uppercase"
            title="AI-агент beide"
          >
            AI
          </Badge>
          <span className="chat-panel__footer-hint">
            первая белорусская ide с агентом
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => void onFilesPicked(e.target.files)}
        />
      </aside>
    </TooltipProvider>
  );
}
