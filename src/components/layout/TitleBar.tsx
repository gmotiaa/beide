import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconFolderOpen,
  IconHelpCircle,
  IconLogout,
  IconMinus,
  IconSettings,
  IconSquare,
  IconSquaresDiagonal,
  IconX,
} from "@tabler/icons-react";
import { appIconUrl } from "../../lib/assets";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Kbd, KbdGroup } from "../ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useWorkspaceStore } from "../../stores/workspace";
import { useAgentStore } from "../../stores/agent";
import { useAuthStore } from "../../stores/auth";
import { useOnboardingStore } from "../../stores/onboarding";
import { getBeide } from "../../lib/ipc";
import { cn } from "../../lib/utils";

export function TitleBar() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const streaming = useAgentStore((s) => s.streaming);
  const mode = useAgentStore((s) => s.mode);
  const model = useAgentStore((s) => s.model);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const [helpOpen, setHelpOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const runWindow = useCallback(
    async (
      action: "minimize" | "maximize" | "close" | "isMaximized",
    ): Promise<boolean | void> => {
      const api = getBeide()?.window;
      if (!api) {
        console.warn("[beide] window API missing — rebuild/restart Electron");
        return;
      }
      try {
        if (action === "minimize") {
          await api.minimize();
          return;
        }
        if (action === "close") {
          await api.close();
          return;
        }
        if (action === "isMaximized") {
          return await api.isMaximized();
        }
        const next = await api.maximize();
        setMaximized(Boolean(next));
        return next;
      } catch (e) {
        console.error(`[beide] window.${action} failed`, e);
      }
    },
    [],
  );

  useEffect(() => {
    void runWindow("isMaximized").then((v) => {
      if (typeof v === "boolean") setMaximized(v);
    });
  }, [runWindow]);

  const folder = rootPath
    ? rootPath.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2).join(" / ")
    : null;

  const modelShort = model
    ? model.includes("/")
      ? model.split("/").pop()
      : model
    : null;

  return (
    <TooltipProvider delay={200}>
      <header
        className="title-bar title-bar--custom"
        onDoubleClick={(e) => {
          // Double-click empty chrome toggles maximize (skip interactive children)
          const t = e.target as HTMLElement;
          if (t.closest("button, a, [role='button'], input")) return;
          void runWindow("maximize");
        }}
      >
        <div className="title-bar__left">
          <div className="title-bar__brand">
            <img
              src={appIconUrl}
              alt=""
              className="title-bar__icon"
              width={20}
              height={20}
              draggable={false}
            />
            <span className="title-bar__name">
              {t("common.appName", "beide")}
            </span>
          </div>

          <div className="title-bar__divider" aria-hidden />

          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  className="title-bar__path-chip"
                  title={rootPath ?? undefined}
                  onClick={() => void openFolder()}
                />
              }
            >
              <IconFolderOpen className="size-3.5 shrink-0 opacity-60" stroke={1.75} />
              <span className="title-bar__path">
                {folder ?? t("status.noWorkspace", "Папка не открыта")}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {rootPath ? t("titleBar.changeFolder") : t("common.openFolder")}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="title-bar__center">
          {streaming ? (
            <Badge
              variant="secondary"
              className="title-bar__status-badge gap-1.5 border-transparent font-normal"
            >
              <span className="title-bar__live-dot" />
              {t("titleBar.thinking")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="title-bar__status-badge font-normal capitalize"
            >
              {mode === "plan" ? t("chat.modePlan") : t("chat.modeAgent")}
            </Badge>
          )}
          {modelShort ? (
            <span className="title-bar__model" title={model}>
              {modelShort}
            </span>
          ) : null}
        </div>

        <div className="title-bar__actions">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="title-bar__menu-btn"
                  aria-label={t("titleBar.menu")}
                />
              }
            >
              {t("titleBar.menu")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[240px]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("titleBar.workspace")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void openFolder()}>
                  <IconFolderOpen className="size-4 text-muted-foreground" />
                  {t("common.openFolder")}
                  <DropdownMenuShortcut>
                    <KbdGroup>
                      <Kbd>Ctrl</Kbd>
                      <Kbd>O</Kbd>
                    </KbdGroup>
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("common.appName", "beide")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => resetOnboarding()}>
                  <IconSettings className="size-4 text-muted-foreground" />
                  {t("titleBar.showOnboarding")}
                </DropdownMenuItem>
                {user ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => void signOut()}
                  >
                    <IconLogout className="size-4" />
                    {t("titleBar.signOut")}
                    <span className="ml-auto max-w-[7rem] truncate text-xs opacity-70">
                      {user.email}
                    </span>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
            <DialogTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("titleBar.about")}
                  className="title-bar__help"
                />
              }
            >
              <IconHelpCircle className="size-4" stroke={1.75} />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" showCloseButton>
              <DialogHeader>
                <DialogTitle>{t("titleBar.helpTitle")}</DialogTitle>
                <DialogDescription>
                  {t("titleBar.helpIntro")}{" "}
                  <strong className="text-foreground">
                    @earendil-works/pi-coding-agent
                  </strong>
                  {t("titleBar.helpAuth")}{" "}
                  <code className="text-foreground">~/.pi/agent</code>
                  {t("titleBar.helpMode")}
                </DialogDescription>
              </DialogHeader>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>L</Kbd>
                  </KbdGroup>
                  <span>{t("titleBar.shortcutChat")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>`</Kbd>
                  </KbdGroup>
                  <span>{t("titleBar.shortcutTerminal")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <KbdGroup>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>S</Kbd>
                  </KbdGroup>
                  <span>{t("titleBar.shortcutSave")}</span>
                </li>
              </ul>
              <DialogFooter>
                <DialogClose render={<Button type="button" />}>
                  {t("titleBar.gotIt")}
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {user ? (
            <Avatar size="sm" className="title-bar__avatar">
              <AvatarFallback className="text-xs">
                {(user.email?.[0] ?? "u").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : null}

          <div
            className="title-bar__win-controls"
            aria-label={t("titleBar.windowControls")}
          >
            <button
              type="button"
              className="title-bar__win-btn"
              aria-label={t("titleBar.minimize")}
              onClick={(e) => {
                e.stopPropagation();
                void runWindow("minimize");
              }}
            >
              <IconMinus className="size-3.5" stroke={2} />
            </button>
            <button
              type="button"
              className="title-bar__win-btn"
              aria-label={maximized ? t("titleBar.restore") : t("titleBar.maximize")}
              onClick={(e) => {
                e.stopPropagation();
                void runWindow("maximize");
              }}
            >
              {maximized ? (
                <IconSquaresDiagonal className="size-3.5" stroke={1.75} />
              ) : (
                <IconSquare className="size-3" stroke={1.75} />
              )}
            </button>
            <button
              type="button"
              className={cn("title-bar__win-btn", "title-bar__win-btn--close")}
              aria-label={t("common.close")}
              onClick={(e) => {
                e.stopPropagation();
                void runWindow("close");
              }}
            >
              <IconX className="size-3.5" stroke={2} />
            </button>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
