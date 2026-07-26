import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconHistory,
  IconMessagePlus,
  IconMessages,
} from "@tabler/icons-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../ui/tooltip";
import { useChatStore } from "../../stores/chat";
import { cn } from "../../lib/utils";
import type { SessionInfo } from "../../lib/types";

function localeFor(language: string): string {
  return language?.startsWith("ru") ? "ru-RU" : "en-US";
}

function formatWhen(ts: number, locale: string): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SessionRow({
  session,
  active,
  onSelect,
}: {
  session: SessionInfo;
  active: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        active && "border-border bg-accent/80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug">
          {session.title || t("chat.newSession")}
        </span>
        <Badge
          variant="outline"
          className="h-5 shrink-0 px-1.5 text-[10px] font-normal capitalize"
        >
          {session.mode === "plan" ? t("chat.modePlan") : t("chat.modeAgent")}
        </Badge>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {formatWhen(session.updatedAt, localeFor(i18n.language))}
      </span>
    </button>
  );
}

export function ChatHistory() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const sessions = useChatStore((s) => s.sessions);
  const sessionsLoading = useChatStore((s) => s.sessionsLoading);
  const sessionId = useChatStore((s) => s.sessionId);
  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const loadSession = useChatStore((s) => s.loadSession);
  const newSession = useChatStore((s) => s.newSession);
  const setError = useChatStore((s) => s.setError);

  useEffect(() => {
    if (open) void refreshSessions();
  }, [open, refreshSessions]);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="chat-panel__history-btn"
              aria-label={t("chat.history")}
              onClick={() => setOpen(true)}
            >
              <IconHistory className="size-4" stroke={1.5} />
            </Button>
          }
        />
        <TooltipContent side="bottom">{t("chat.history")}</TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[min(100vw,360px)] gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2">
              <IconMessages className="size-4 text-muted-foreground" />
              {t("chat.history")}
            </SheetTitle>
            <SheetDescription>{t("chat.historyHint")}</SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 px-4 py-3">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                void newSession().then(() => {
                  setError(null);
                  setOpen(false);
                });
              }}
            >
              <IconMessagePlus className="size-4" />
              {t("chat.newSession")}
            </Button>
          </div>

          <Separator />

          <ScrollArea className="h-[calc(100vh-11rem)] px-2 py-2">
            <div className="flex flex-col gap-1">
              {sessionsLoading && !sorted.length ? (
                <>
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </>
              ) : null}

              {!sessionsLoading && !sorted.length ? (
                <div className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {t("chat.historyEmpty")}
                  <br />
                  {t("chat.historyEmptyHint")}
                </div>
              ) : null}

              {sorted.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === sessionId}
                  onSelect={() => {
                    void loadSession(s.id).then(() => {
                      setError(null);
                      setOpen(false);
                    });
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
