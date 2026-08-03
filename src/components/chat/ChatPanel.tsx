import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatStatus, UIMessage } from "ai";
import {
  IconBulb,
  IconCode,
  IconFile,
  IconFileText,
  IconFolder,
  IconPhoto,
  IconPlus,
  IconRobot,
  IconSearch,
  IconTerminal2,
} from "@tabler/icons-react";
import { getTerminalSnapshot } from "../../lib/terminal-buffer";
import {
  loadPromptLibrary,
  type PromptTemplate,
} from "../../lib/prompt-library";

import { MessageList } from "../agent-elements/message-list";
import {
  InputBar,
  type ComposerMenuItem,
  type ComposerMenuSource,
} from "../agent-elements/input-bar";
import { ModeSelector } from "../agent-elements/input/mode-selector";
import { ModelPicker } from "../agent-elements/input/model-picker";
import { Suggestions, type SuggestionItem } from "../agent-elements/input/suggestions";
import { TextShimmer } from "../agent-elements/text-shimmer";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Kbd, KbdGroup } from "../ui/kbd";
import { Icons } from "../common/IconButton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { ChatHistory } from "./ChatHistory";

import { useAgentStore } from "../../stores/agent";
import { useChatStore } from "../../stores/chat";
import { useUsageStore } from "../../stores/usage";
import { useWorkspaceStore } from "../../stores/workspace";
import { toUIMessages } from "../../lib/to-ui-messages";
import {
  DEFAULT_MODEL_ID,
  MODEL_CATALOG,
  MODEL_OPTIONS,
  VENDOR_LABELS,
  findModel,
} from "../../lib/models";
import type { AgentMode, ChatImage } from "../../lib/types";
import { cn } from "../../lib/utils";

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

/**
 * The header used to slice the raw id at the "/" — so it read "minimax-m3"
 * while the ModelPicker two rows below said "MiniMax M3" for the same model.
 * `findModel` is the catalog's own resolver and tolerates a `provider/` prefix.
 */
function modelLabelFor(model?: string): string | null {
  if (!model) return null;
  const found = findModel(model);
  return found ? `${found.name} ${found.version}` : model;
}

/** Workspace paths arrive with either separator — take the last segment. */
function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/** Cap on file rows in the "@" menu; specials come on top of these. */
const MENTION_FILE_LIMIT = 8;

export function ChatPanel() {
  const { t } = useTranslation();
  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);
  const streaming = useAgentStore((s) => s.streaming);
  const ready = useAgentStore((s) => s.ready);
  const model = useAgentStore((s) => s.model);
  const setModel = useAgentStore((s) => s.setModel);
  const providers = useAgentStore((s) => s.providers);
  const providersLoaded = useAgentStore((s) => s.providersLoaded);
  const plan = useUsageStore((s) => s.data.plan);
  const retryNotice = useAgentStore((s) => s.retryNotice);
  const send = useAgentStore((s) => s.send);
  const abort = useAgentStore((s) => s.abort);

  const messages = useChatStore((s) => s.messages);
  const error = useChatStore((s) => s.error);
  const draft = useChatStore((s) => s.draft);
  const setDraft = useChatStore((s) => s.setDraft);
  const images = useChatStore((s) => s.images);
  const addImage = useChatStore((s) => s.addImage);
  const removeImage = useChatStore((s) => s.removeImage);
  const mentions = useChatStore((s) => s.mentions);
  const newSession = useChatStore((s) => s.newSession);
  const setError = useChatStore((s) => s.setError);
  const refreshSessions = useChatStore((s) => s.refreshSessions);
  const restoreActiveSession = useChatStore((s) => s.restoreActiveSession);
  const openFolder = useWorkspaceStore((s) => s.openFolder);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Pasting/dropping an image against a text-only model used to be a silent
  // no-op — onPaste/onDrop just returned early — so the user assumed the
  // feature was broken. This is a self-clearing timed hint shown through the
  // same infoBar slot the composer already uses for other notices.
  const [imagesUnsupportedNotice, setImagesUnsupportedNotice] = useState(false);
  const imagesUnsupportedTimeoutRef = useRef<number | null>(null);

  const dismissImagesUnsupportedNotice = useCallback(() => {
    setImagesUnsupportedNotice(false);
    if (imagesUnsupportedTimeoutRef.current !== null) {
      window.clearTimeout(imagesUnsupportedTimeoutRef.current);
      imagesUnsupportedTimeoutRef.current = null;
    }
  }, []);

  const showImagesUnsupportedNotice = useCallback(() => {
    setImagesUnsupportedNotice(true);
    if (imagesUnsupportedTimeoutRef.current !== null) {
      window.clearTimeout(imagesUnsupportedTimeoutRef.current);
    }
    imagesUnsupportedTimeoutRef.current = window.setTimeout(() => {
      setImagesUnsupportedNotice(false);
      imagesUnsupportedTimeoutRef.current = null;
    }, 5000);
  }, []);

  useEffect(
    () => () => {
      if (imagesUnsupportedTimeoutRef.current !== null) {
        window.clearTimeout(imagesUnsupportedTimeoutRef.current);
      }
    },
    [],
  );

  const modes = useMemo(
    () => [
      {
        id: "agent",
        label: t("chat.agent"),
        icon: IconRobot,
        description: t("chat.agentHint"),
      },
      {
        id: "plan",
        label: t("chat.plan"),
        icon: IconBulb,
        description: t("chat.planHint"),
      },
    ],
    [t],
  );

  const suggestionItems = useMemo<SuggestionItem[]>(
    () => [
      {
        id: "map",
        label: t("chat.suggestions.map.label"),
        value: t("chat.suggestions.map.value"),
        icon: <IconFolder className="h-3.5 w-3.5" aria-hidden />,
      },
      {
        id: "risks",
        label: t("chat.suggestions.risks.label"),
        value: t("chat.suggestions.risks.value"),
        icon: <IconSearch className="h-3.5 w-3.5" aria-hidden />,
      },
      {
        id: "code",
        label: t("chat.suggestions.code.label"),
        value: t("chat.suggestions.code.value"),
        icon: <IconCode className="h-3.5 w-3.5" aria-hidden />,
      },
      {
        id: "layout",
        label: t("chat.suggestions.layout.label"),
        value: t("chat.suggestions.layout.value"),
        icon: <IconPhoto className="h-3.5 w-3.5" aria-hidden />,
      },
    ],
    [t],
  );

  // ---- "@" mention menu ----------------------------------------------------
  const mentionMenu = useMemo<ComposerMenuSource>(
    () => ({
      getItems: async (query) => {
        const q = query.trim().toLowerCase();
        const items: ComposerMenuItem[] = [];
        // Special targets first, filtered by name prefix like the files are.
        if (!q || "terminal".startsWith(q)) {
          items.push({
            id: "special:terminal",
            label: "@terminal",
            hint: t("chat.attachTerminal"),
            icon: <IconTerminal2 className="size-3.5" stroke={1.75} aria-hidden />,
          });
        }
        if (!q || "codebase".startsWith(q)) {
          items.push({
            id: "special:codebase",
            label: "@codebase",
            hint: t("chat.mentionCodebase"),
            icon: <IconSearch className="size-3.5" stroke={1.75} aria-hidden />,
          });
        }
        if (q.length >= 1) {
          const files = await useWorkspaceStore.getState().searchFiles(q);
          for (const path of files.slice(0, MENTION_FILE_LIMIT)) {
            items.push({
              id: `file:${path}`,
              label: basename(path),
              hint: path,
              icon: <IconFile className="size-3.5" stroke={1.75} aria-hidden />,
            });
          }
        }
        return items;
      },
      onSelect: (item) => {
        if (item.id === "special:terminal") {
          const chat = useChatStore.getState();
          const snapshot = getTerminalSnapshot();
          if (!snapshot.trim()) {
            chat.setError(t("chat.attachTerminalEmpty"));
            return ""; // drop the "@…" token, nothing to attach
          }
          return `\n\`\`\`terminal\n${snapshot}\n\`\`\`\n`;
        }
        if (item.id === "special:codebase") {
          // Left in the draft on purpose: the user types the query inline and
          // main resolves "@codebase <query>" into content-search results.
          return "@codebase ";
        }
        if (item.id.startsWith("file:")) {
          const path = item.id.slice("file:".length);
          useChatStore
            .getState()
            .addMention({ type: "file", path, name: basename(path) });
          return ""; // the mention chip replaces the typed token
        }
        return null;
      },
    }),
    [t],
  );

  // ---- "/" prompt library menu ----------------------------------------------
  // onSelect is synchronous, so the templates from the latest getItems() call
  // are kept here for the content lookup.
  const promptsRef = useRef<PromptTemplate[]>([]);
  const promptMenu = useMemo<ComposerMenuSource>(
    () => ({
      getItems: async (query) => {
        const prompts = await loadPromptLibrary();
        promptsRef.current = prompts;
        if (prompts.length === 0) {
          return [
            { id: "prompts:empty", label: t("chat.promptsEmpty"), disabled: true },
          ];
        }
        const q = query.trim().toLowerCase();
        return prompts
          .filter((prompt) => !q || prompt.name.toLowerCase().includes(q))
          .map((prompt) => ({
            id: `prompt:${prompt.name}`,
            label: `/${prompt.name}`,
            icon: <IconFileText className="size-3.5" stroke={1.75} aria-hidden />,
          }));
      },
      onSelect: (item) => {
        if (!item.id.startsWith("prompt:")) return null;
        const name = item.id.slice("prompt:".length);
        const found = promptsRef.current.find((prompt) => prompt.name === name);
        return found ? found.content : null;
      },
    }),
    [t],
  );

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions, ready]);

  // The transcript lives in memory only. A renderer reload — HMR in dev, a
  // crash, a restart — used to wipe it while the agent kept streaming, so the
  // prompt and the tool cards vanished and the tail of the answer opened a new
  // orphan session. Pick the conversation back up from the one main is on.
  useEffect(() => {
    void restoreActiveSession();
  }, [restoreActiveSession, ready]);

  const uiMessages = useMemo(() => toUIMessages(messages), [messages]);
  const modelLabel = modelLabelFor(model);
  const hasConnectedProvider = providers.some((provider) => provider.connected);
  const canSend = ready && providersLoaded && hasConnectedProvider;

  /**
   * Offering a model whose provider holds no credentials only buys a failed
   * request three steps later — models are listed once the EchoGate key is in
   * place, and hidden otherwise. Until the status arrives, or if nothing at
   * all is connected, the full catalog stays visible so the picker never
   * renders empty.
   */
  const modelOptions = useMemo(() => {
    // Pro-tier models stay visible on Free (so the tier is discoverable) but
    // are not selectable; the "· Pro" suffix says why. Main enforces the same
    // gate, the model-proxy enforces it authoritatively.
    const proLocked = plan !== "pro";
    const withGroups = (list: typeof MODEL_OPTIONS) =>
      list.map(({ id, name, version, vendor, disabled, tier }) => ({
        id,
        name,
        version: tier === "pro" ? `${version} · Pro` : version,
        disabled: disabled || (tier === "pro" && proLocked),
        group: VENDOR_LABELS[vendor],
      }));
    if (!providers.length) return withGroups(MODEL_OPTIONS);
    const connected = new Set(
      providers.filter((p) => p.connected).map((p) => p.id),
    );
    const current = findModel(model ?? "");
    const allowed = MODEL_CATALOG.filter(
      (m) => connected.has(m.provider) || m.id === current?.id,
    );
    if (!allowed.length) return withGroups(MODEL_OPTIONS);
    return withGroups(allowed);
  }, [providers, model, plan]);

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
            title: t("chat.requestError"),
            message: error,
          } as unknown as UIMessage["parts"][number],
        ],
      },
    ];
  }, [uiMessages, error, t]);

  const attachedImages = useMemo(
    () =>
      images.map((img, i) => ({
        id: `img-${i}`,
        filename: img.name ?? t("chat.imageName", { n: i + 1 }),
        url: `data:${img.mimeType};base64,${img.data}`,
      })),
    [images, t],
  );

  // Store mentions had no composer presence at all — a file picked in the "@"
  // menu was sent with the prompt but never shown. Surface them as the same
  // chips the composer already draws for attachments. (The store only offers
  // addMention/clearMentions, so the chips carry no per-item remove button.)
  const attachedMentionFiles = useMemo(
    () =>
      mentions.map((mention) => ({
        id: `mention:${mention.path}`,
        filename: mention.name,
      })),
    [mentions],
  );

  const onSend = useCallback(
    ({ content }: { role?: string; content: string }) => {
      if (!ready) {
        setError(t("chat.openProjectFirst"));
        return;
      }
      if (!providersLoaded || !hasConnectedProvider) {
        setError(t("chat.noProviderConfigured"));
        return;
      }
      const text = (content ?? "").trim();
      if (!text && images.length === 0) return;
      // The input bar clears itself synchronously on submit, but the limit
      // gate inside send() is async — a refusal used to eat the typed prompt.
      void send(text).then((dispatched) => {
        if (!dispatched) setDraft(text);
      });
    },
    [
      ready,
      providersLoaded,
      hasConnectedProvider,
      send,
      setError,
      setDraft,
      images.length,
      t,
    ],
  );

  const onStop = useCallback(() => {
    void abort();
  }, [abort]);

  // Half the catalog is text-only. The attach button used to be offered for
  // every model, so an image staged against e.g. Nemotron was only rejected
  // once the request reached the provider.
  const supportsImages = findModel(model ?? "")?.supportsImages ?? false;

  const onAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesPicked = useCallback(
    async (list: FileList | null) => {
      if (!list || !supportsImages) return;
      for (const file of Array.from(list)) {
        const img = await fileToChatImage(file);
        if (img) addImage(img);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addImage, supportsImages],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/"),
      );
      if (imageItems.length === 0) return;
      if (!supportsImages) {
        e.preventDefault();
        showImagesUnsupportedNotice();
        return;
      }
      for (const item of imageItems) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          void fileToChatImage(file).then((img) => img && addImage(img));
        }
      }
    },
    [addImage, supportsImages, showImagesUnsupportedNotice],
  );

  // The chips belong to the empty state, not to the composer: docked under the
  // input they crowd the footer and read as a toolbar. Placed here they are
  // what the panel offers while there is nothing to read — the same placement
  // AgentChat calls `emptySuggestionsPlacement="empty"`.
  const onSuggestion = useCallback(
    (item: SuggestionItem) => {
      setDraft(item.value ?? item.label);
      requestAnimationFrame(() => {
        const el = document.getElementById("chat-composer");
        if (!(el instanceof HTMLTextAreaElement)) return;
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
      });
    },
    [setDraft],
  );

  // The composer is the natural home for "you have no project open": it sits
  // next to the control that fixes it. `infoBar` is the slot the library
  // provides for exactly this.
  const infoBar = useMemo(() => {
    if (!ready) {
      return {
        title: t("chat.noProjectTitle"),
        description: t("chat.noProjectBody"),
        action: {
          label: t("chat.noProjectAction"),
          onClick: () => void openFolder(),
        },
      };
    }
    // Mid-turn retries happen after the planning row is gone — the composer
    // info bar is the only place that is always visible.
    if (retryNotice) {
      return { title: retryNotice, description: t("chat.providerRetryHint") };
    }
    if (imagesUnsupportedNotice) {
      return {
        title: t("chat.imagesUnsupportedHint"),
        onClose: dismissImagesUnsupportedNotice,
      };
    }
    return undefined;
  }, [
    ready,
    retryNotice,
    imagesUnsupportedNotice,
    dismissImagesUnsupportedNotice,
    openFolder,
    t,
  ]);

  return (
    <TooltipProvider delay={200}>
      <aside
        className={cn(
          // Surface treatment (radius, ring, elevation) comes from shell.css so
          // every panel in the shell stays consistent.
          "chat-panel chat-panel--ae relative flex flex-col transition-colors duration-200",
          isDragOver && "chat-panel--drag ring-2 ring-accent/60",
        )}
        data-mode={mode}
        data-streaming={streaming ? "1" : "0"}
        data-ready={ready ? "1" : "0"}
        aria-label={t("chat.ariaLabel")}
        onDragOver={(e) => {
          // preventDefault must run regardless of model support, or the
          // browser's own "no drop" handling swallows the event before it
          // ever reaches onDrop — which is where the unsupported-model hint
          // is shown. The drag-ring highlight itself stays vision-only.
          e.preventDefault();
          if (supportsImages) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!supportsImages) {
            const hasImage = Array.from(e.dataTransfer.files).some((file) =>
              file.type.startsWith("image/"),
            );
            if (hasImage) showImagesUnsupportedNotice();
            return;
          }
          void onFilesPicked(e.dataTransfer.files);
        }}
      >
        <div className="chat-panel__header sticky top-0 z-10 flex items-center justify-between px-3 py-2">
          <div className="chat-panel__title-row flex items-center gap-2">
            <span
              className={cn(
                "chat-panel__status-dot transition-all duration-300",
                ready ? "is-ready" : "is-idle",
                streaming && "is-live scale-110",
              )}
              aria-hidden
            />
            <span className="chat-panel__title font-semibold tracking-tight">
              {mode === "plan" ? t("chat.plan") : t("chat.agent")}
            </span>
            {modelLabel && (
              <Badge
                variant="outline"
                className="chat-panel__model-badge truncate text-[10.5px] font-normal"
                title={model}
              >
                {modelLabel}
              </Badge>
            )}
            {streaming && (
              <Badge
                variant="secondary"
                className="chat-panel__live-badge gap-1.5 border-accent/40 px-2.5 font-normal"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-accent" />
                <TextShimmer as="span" duration={1.2} spread={60} className="text-accent-foreground font-medium">
                  {t("chat.streaming")}
                </TextShimmer>
              </Badge>
            )}
          </div>

          <div className="chat-panel__header-actions flex items-center gap-1">
            <ChatHistory />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="chat-panel__new hover:bg-accent/20 active:scale-95 transition-transform"
                    aria-label={t("chat.newSession")}
                    onClick={() => {
                      void newSession();
                      setError(null);
                    }}
                  >
                    <IconPlus className="size-4" stroke={1.5} />
                  </Button>
                }
              />
              <TooltipContent side="bottom">{t("chat.newSession")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* The header already draws its own hairline; a Separator here
            stacked a second one on top of it. */}
        <div className="chat-panel__body flex flex-1 flex-col overflow-hidden">
          <div className="chat-panel__scroll scrollbar-custom flex-1 overflow-y-auto px-1 py-2">
            {messages.length === 0 && !error ? (
              <div className="chat-panel__empty flex flex-col items-center justify-center text-center p-6 my-auto">
                <div className="chat-panel__empty-icon mb-3" aria-hidden>
                  {Icons.chat}
                </div>
                <div className="chat-panel__empty-title">{t("chat.emptyTitle")}</div>
                <p className="chat-panel__empty-body mt-1 leading-relaxed max-w-xs">
                  {t("chat.emptyBody")}
                </p>
                {ready && (
                  <Suggestions
                    items={suggestionItems}
                    onSelect={onSuggestion}
                    disabled={streaming}
                    className="chat-panel__suggestions"
                    itemClassName="chat-panel__suggestion"
                  />
                )}
                {/* The "no project" case is handled by the composer's infoBar,
                    which sits next to the button that resolves it. */}
                {ready && (
                  <KbdGroup className="chat-panel__empty-keys">
                    <Kbd>Ctrl</Kbd>
                    <Kbd>L</Kbd>
                    <span className="chat-panel__empty-keys-hint">{t("chat.focusHint")}</span>
                  </KbdGroup>
                )}
              </div>
            ) : (
              <MessageList
                messages={listMessages}
                status={status}
                showCopyToolbar
                enableImagePreview
                className="chat-panel__messages"
                planningLabelOverride={retryNotice ?? undefined}
              />
            )}
            {/* MessageList renders the error part appended to listMessages, so
                the standalone ErrorMessage that used to sit here showed the
                same error a second time whenever the transcript was empty. */}
          </div>

          <div className="chat-panel__composer glow-border-focus relative">
            <InputBar
              onSend={onSend}
              status={status}
              onStop={onStop}
              value={draft}
              onChange={setDraft}
              placeholder={
                !ready
                  ? t("chat.openProjectFirst")
                  : !providersLoaded
                    ? t("chat.checkingProvider")
                    : hasConnectedProvider
                      ? t("chat.placeholder")
                      : t("chat.noProviderConfigured")
              }
              disabled={!canSend}
              onAttach={supportsImages ? onAttach : undefined}
              attachedImages={attachedImages}
              attachedFiles={attachedMentionFiles}
              mentionMenu={mentionMenu}
              promptMenu={promptMenu}
              onRemoveImage={(id) => {
                const idx = Number(String(id).replace("img-", ""));
                if (!Number.isNaN(idx)) removeImage(idx);
              }}
              onPaste={onPaste}
              isDragOver={isDragOver}
              enableImagePreview
              // AppLayout's Ctrl+L handler focuses #chat-composer; nothing in
              // the tree carried that id, so the shortcut opened the panel and
              // then dropped the focus.
              textareaId="chat-composer"
              infoBar={infoBar}
              leftActions={
                <div className="flex items-center gap-1.5">
                  <ModeSelector
                    modes={modes}
                    value={mode}
                    onChange={(id) => void setMode(id as AgentMode)}
                  />
                  <ModelPicker
                    models={modelOptions}
                    value={model || DEFAULT_MODEL_ID}
                    onChange={(selectedId) => void setModel(selectedId)}
                  />
                  {/* The "@terminal" button moved into the "@" mention menu. */}
                </div>
              }
              className="beide-agent-input"
            />
          </div>
        </div>

        {/* Border, surface and type come from .chat-panel__footer in shell.css —
            the utilities that used to be here painted a second, conflicting
            background that the stylesheet then overrode anyway. */}
        <div className="chat-panel__footer">
          <Badge
            variant="outline"
            className="chat-panel__ai-badge"
            title={t("chat.aiBadgeTitle")}
          >
            AI
          </Badge>
          <span className="chat-panel__footer-hint truncate">
            {t("chat.footerTagline")}
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
