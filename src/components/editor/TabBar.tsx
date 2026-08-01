import { useTranslation } from "react-i18next";
import { IconColumns2, IconMarkdown, IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorStore } from "../../stores/editor";

interface TabBarProps {
  /** Show the markdown preview toggle (active tab is markdown). */
  mdPreviewAvailable?: boolean;
  mdPreviewOn?: boolean;
  onToggleMdPreview?: () => void;
}

export function TabBar({
  mdPreviewAvailable = false,
  mdPreviewOn = false,
  onToggleMdPreview,
}: TabBarProps) {
  const { t } = useTranslation();
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const splitPath = useEditorStore((s) => s.splitPath);
  const setActive = useEditorStore((s) => s.setActive);
  const setSplit = useEditorStore((s) => s.setSplit);
  const closeTab = useEditorStore((s) => s.closeTab);

  if (!tabs.length) return null;

  // Closing a dirty tab used to drop the buffer with no warning.
  const requestClose = (path: string, name: string, dirty: boolean) => {
    if (dirty && !window.confirm(t("editor.closeUnsavedConfirm", { name }))) {
      return;
    }
    closeTab(path);
  };

  return (
    <TooltipProvider delay={400}>
      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => {
          const active = tab.path === activePath;
          return (
            <div
              key={tab.path}
              className={`tab${active ? " is-active" : ""}`}
              role="tab"
              aria-selected={active}
              tabIndex={0}
              title={tab.path}
              onClick={() => setActive(tab.path)}
              onKeyDown={(e) => {
                // Only when the tab itself is focused — Enter/Space on the
                // close button inside bubbles up here too.
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActive(tab.path);
                }
              }}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  requestClose(tab.path, tab.name, tab.dirty);
                }
              }}
            >
              {tab.dirty ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        className="tab__dirty"
                        aria-label={t("editor.dirtyDot")}
                      />
                    }
                  />
                  <TooltipContent>
                    <p>{t("editor.unsaved")}</p>
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <span className="tab__name">{tab.name}</span>
              {tab.language ? (
                <Badge variant="secondary" className="tab__lang">
                  {tab.language}
                </Badge>
              ) : null}
              {active ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("editor.splitRight")}
                  aria-pressed={splitPath === tab.path}
                  title={t("editor.splitRight")}
                  className="tab__split"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSplit(splitPath === tab.path ? null : tab.path);
                  }}
                >
                  <IconColumns2 className="size-3.5" stroke={2} />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("editor.closeTab")}
                className="tab__close"
                onClick={(e) => {
                  // The click bubbles to the tab div, whose onClick would
                  // re-activate the path this handler just closed.
                  e.stopPropagation();
                  requestClose(tab.path, tab.name, tab.dirty);
                }}
              >
                <IconX className="size-3.5" stroke={2} />
              </Button>
            </div>
          );
        })}
        {mdPreviewAvailable && onToggleMdPreview ? (
          <div className="tab-bar__actions">
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={mdPreviewOn}
              className={mdPreviewOn ? "text-primary" : undefined}
              onClick={onToggleMdPreview}
            >
              <IconMarkdown className="size-3.5" stroke={1.75} />
              {t("editor.mdPreview")}
            </Button>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
