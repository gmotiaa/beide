import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  IconFileText,
  IconGauge,
  IconHistory,
  IconPalette,
  IconPlugConnected,
  IconRobot,
  IconShield,
} from "@tabler/icons-react";
import { useUsageStore } from "../../stores/usage";
import { appIconUrl } from "../../lib/assets";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { usageHeadline } from "./helpers";
import { RulesSection } from "./RulesSection";
import { UsageSection } from "./UsageSection";
import {
  AgentSection,
  AppearanceSection,
  CheckpointsSection,
  PrivacySection,
  ProvidersSection,
} from "./sections";

type SectionId =
  | "account"
  | "appearance"
  | "agent"
  | "rules"
  | "providers"
  | "privacy"
  | "checkpoints";

interface SectionDef {
  id: SectionId;
  icon: ReactNode;
  labelKey: string;
  render: () => ReactNode;
}

const SECTIONS: SectionDef[] = [
  {
    id: "account",
    icon: <IconGauge className="size-4" stroke={1.75} />,
    labelKey: "settings.navAccount",
    render: () => <UsageSection />,
  },
  {
    id: "appearance",
    icon: <IconPalette className="size-4" stroke={1.75} />,
    labelKey: "settings.navAppearance",
    render: () => <AppearanceSection />,
  },
  {
    id: "agent",
    icon: <IconRobot className="size-4" stroke={1.75} />,
    labelKey: "settings.navAgent",
    render: () => <AgentSection />,
  },
  {
    id: "rules",
    icon: <IconFileText className="size-4" stroke={1.75} />,
    labelKey: "settings.navRules",
    render: () => <RulesSection />,
  },
  {
    id: "providers",
    icon: <IconPlugConnected className="size-4" stroke={1.75} />,
    labelKey: "settings.navProviders",
    render: () => <ProvidersSection />,
  },
  {
    id: "privacy",
    icon: <IconShield className="size-4" stroke={1.75} />,
    labelKey: "settings.navPrivacy",
    render: () => <PrivacySection />,
  },
  {
    id: "checkpoints",
    icon: <IconHistory className="size-4" stroke={1.75} />,
    labelKey: "settings.navCheckpoints",
    render: () => <CheckpointsSection />,
  },
];

export function SettingsView() {
  const { t } = useTranslation();
  const [active, setActive] = useState<SectionId>("account");
  const usageData = useUsageStore((s) => s.data);
  const loadUsage = useUsageStore((s) => s.load);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  // Only the tightest of the two windows is worth showing in the nav.
  const quota = useMemo(() => usageHeadline(usageData), [usageData]);
  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="settings-view">
      <div className="settings-view__inner">
        <header className="settings-view__hero">
          <div className="settings-view__logo" aria-hidden>
            <img src={appIconUrl} alt="" className="size-9 rounded-[10px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1>{t("settings.title")}</h1>
            <p className="settings-view__lead">{t("settings.lead")}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 font-normal">
            beide
          </Badge>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label={t("settings.title")}>
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                aria-current={section.id === active ? "page" : undefined}
                className={cn(
                  "settings-nav__item",
                  section.id === active && "settings-nav__item--active",
                )}
              >
                <span className="settings-nav__icon">{section.icon}</span>
                <span className="settings-nav__label">{t(section.labelKey)}</span>
                {section.id === "account" ? (
                  <span
                    className={cn(
                      "settings-nav__meta tabular-nums",
                      quota.low && "is-low",
                    )}
                  >
                    {Math.round(quota.pct)}%
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="settings-content">{current.render()}</div>
        </div>
      </div>
    </div>
  );
}
