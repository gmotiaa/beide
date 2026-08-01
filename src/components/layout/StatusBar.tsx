import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBeide } from "../../lib/ipc";
import { findModel } from "../../lib/models";
import { useAgentStore } from "../../stores/agent";
import { useEditorStore } from "../../stores/editor";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";

const HEALTH_POLL_MS = 90_000;

/**
 * Gateway reachability, polled lazily. `null` = unknown/probing — the badge
 * only appears once the gateway has actually failed a probe, so a healthy
 * install never shows extra chrome.
 */
function useGatewayHealth(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const probe = async () => {
      const api = getBeide();
      if (!api) return;
      try {
        const res = await api.agent.health();
        if (alive) setOk(res.ok);
      } catch {
        if (alive) setOk(false);
      }
    };
    void probe();
    const timer = setInterval(() => void probe(), HEALTH_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return ok;
}

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
  const gatewayOk = useGatewayHealth();

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
        {gatewayOk === false && (
          <span
            className="status-bar__item"
            style={{ color: "var(--warning)" }}
            title={t("status.gatewayDownHint")}
          >
            {t("status.gatewayDown")}
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
          <span className="status-bar__item" title={t("status.model")}>
            {shownModel}
          </span>
        )}
      </div>
    </footer>
  );
}
