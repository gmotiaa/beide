import { useTranslation } from "react-i18next";
import { findModel } from "../../lib/models";
import { useAgentStore } from "../../stores/agent";
import { useEditorStore } from "../../stores/editor";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";

export function StatusBar() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const activePath = useEditorStore((s) => s.activePath);
  const tabs = useEditorStore((s) => s.tabs);
  const line = useEditorStore((s) => s.cursorLine);
  const col = useEditorStore((s) => s.cursorCol);
  const streaming = useAgentStore((s) => s.streaming);
  const model = useAgentStore((s) => s.model);
  const modelLabel = useSettingsStore((s) => s.settings.modelLabel);
  const mode = useAgentStore((s) => s.mode);

  const active = tabs.find((tab) => tab.path === activePath);
  // Same display name as the picker — the raw id ("gpt-5.6-terra") read like
  // a debug artifact in the corner of every window.
  const rawModel = model || modelLabel;
  const entry = rawModel ? findModel(rawModel) : undefined;
  const shownModel = entry ? `${entry.name} ${entry.version}` : rawModel;

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__item">
          <span className={`status-dot${streaming ? " is-busy" : ""}`} />
          {streaming ? t("status.streaming") : t("status.ready")}
        </span>
        <span className="status-bar__item mono" title={rootPath ?? undefined}>
          {rootPath ? rootPath.replace(/\\/g, "/").split("/").slice(-2).join("/") : t("status.noWorkspace")}
        </span>
        <span className="status-bar__item">
          {mode === "plan" ? t("chat.modePlan") : t("chat.modeAgent")}
        </span>
      </div>
      <div className="status-bar__right">
        {active && (
          <>
            <span className="status-bar__item">
              {t("status.lineCol", { line, col })}
            </span>
            <span className="status-bar__item">{active.language}</span>
          </>
        )}
        {shownModel && (
          <span className="status-bar__item" title={t("status.model")}>
            {shownModel}
          </span>
        )}
      </div>
    </footer>
  );
}
