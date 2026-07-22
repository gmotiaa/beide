import { useTranslation } from "react-i18next";
import { Chip, CloseButton, Tooltip } from "@heroui/react";
import { useEditorStore } from "../../stores/editor";

export function TabBar() {
  const { t } = useTranslation();
  const tabs = useEditorStore((s) => s.tabs);
  const activePath = useEditorStore((s) => s.activePath);
  const setActive = useEditorStore((s) => s.setActive);
  const closeTab = useEditorStore((s) => s.closeTab);

  if (!tabs.length) return null;

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            className={`tab${active ? " is-active" : ""}`}
            role="tab"
            aria-selected={active}
            title={tab.path}
            onClick={() => setActive(tab.path)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.path);
              }
            }}
          >
            {tab.dirty ? (
              <Tooltip delay={400}>
                <Tooltip.Trigger aria-label={t("editor.dirtyDot")}>
                  <span className="tab__dirty" />
                </Tooltip.Trigger>
                <Tooltip.Content>
                  <p>{t("editor.unsaved")}</p>
                </Tooltip.Content>
              </Tooltip>
            ) : null}
            <span className="tab__name">{tab.name}</span>
            {tab.language ? (
              <Chip size="sm" variant="tertiary" className="tab__lang">
                {tab.language}
              </Chip>
            ) : null}
            <CloseButton
              aria-label={t("editor.closeTab")}
              className="tab__close"
              onPress={() => closeTab(tab.path)}
            />
          </div>
        );
      })}
    </div>
  );
}
