import { useTranslation } from "react-i18next";
import type { AgentMode } from "../../lib/types";

interface ModeToggleProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  const { t } = useTranslation();

  return (
    <div className="mode-toggle" role="group" aria-label="Agent mode">
      <button
        type="button"
        className={`mode-toggle__btn${mode === "plan" ? " is-active" : ""}`}
        title={t("chat.planHint")}
        disabled={disabled}
        onClick={() => onChange("plan")}
      >
        {t("chat.modePlan")}
      </button>
      <button
        type="button"
        className={`mode-toggle__btn${mode === "agent" ? " is-active" : ""}`}
        title={t("chat.agentHint")}
        disabled={disabled}
        onClick={() => onChange("agent")}
      >
        {t("chat.modeAgent")}
      </button>
    </div>
  );
}
