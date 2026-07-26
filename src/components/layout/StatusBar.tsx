import { useTranslation } from "react-i18next";
import {
  IconFolderOpen,
  IconMap2,
  IconPointFilled,
  IconRobot,
} from "@tabler/icons-react";
import { useAgentStore } from "../../stores/agent";
import { useEditorStore } from "../../stores/editor";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";

export function StatusBar() {
  const { t } = useTranslation();
  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const activePath = useEditorStore((s) => s.activePath);
  const tabs = useEditorStore((s) => s.tabs);
  const line = useEditorStore((s) => s.cursorLine);
  const col = useEditorStore((s) => s.cursorCol);
  const streaming = useAgentStore((s) => s.streaming);
  const model = useAgentStore((s) => s.model);
  const modelLabel = useSettingsStore((s) => s.settings.modelLabel);
  const mode = useAgentStore((s) => s.mode);
  const setMode = useAgentStore((s) => s.setMode);

  const active = tabs.find((tab) => tab.path === activePath);
  const shownModel = model || modelLabel;
  const dirty = tabs.filter((tab) => tab.dirty).length;
  const workspaceName = rootPath
    ? rootPath.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2).join("/")
    : null;

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__item">
          <span className={`status-dot${streaming ? " is-busy" : ""}`} />
          {streaming ? t("status.streaming") : t("status.ready")}
        </span>

        {/* The bar used to only report state; the two things a user reaches for
            from here — the workspace and the agent mode — are now actionable. */}
        <button
          type="button"
          className="status-bar__button"
          title={`${t("common.openFolder")} · Ctrl+O`}
          onClick={() => void openFolder()}
        >
          <IconFolderOpen className="size-3.5" stroke={1.75} />
          <span className="status-bar__item mono">
            {workspaceName ?? t("status.noWorkspace")}
          </span>
        </button>

        <button
          type="button"
          className={`status-bar__button${mode === "plan" ? " is-plan" : ""}`}
          title={t("status.toggleMode")}
          onClick={() => void setMode(mode === "plan" ? "agent" : "plan")}
        >
          {mode === "plan" ? (
            <IconMap2 className="size-3.5" stroke={1.75} />
          ) : (
            <IconRobot className="size-3.5" stroke={1.75} />
          )}
          {mode === "plan" ? t("chat.modePlan") : t("chat.modeAgent")}
        </button>

        {dirty > 0 && (
          <span className="status-bar__item status-bar__dirty">
            <IconPointFilled className="size-3" />
            {dirty} · {t("status.unsaved")}
          </span>
        )}
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
          <span className="status-bar__item mono" title={t("status.model")}>
            {shownModel}
          </span>
        )}
      </div>
    </footer>
  );
}
