import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  IconHistory,
  IconLanguage,
  IconMoon,
  IconPalette,
  IconPlugConnected,
  IconRobot,
  IconShield,
  IconSparkles,
  IconSun,
} from "@tabler/icons-react";
import type {
  AgentMode,
  LanguageId,
  PermissionMode,
  ThemeId,
} from "../../lib/types";
import { useAgentStore } from "../../stores/agent";
import { useOnboardingStore } from "../../stores/onboarding";
import { useSettingsStore } from "../../stores/settings";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { ChoiceGroup, Field, Panel, Row } from "./parts";

export function AppearanceSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);

  return (
    <Panel
      icon={<IconPalette className="size-4" stroke={1.75} />}
      title={t("settings.appearance")}
      description={t("settings.appearanceHint")}
    >
      <Field label={t("settings.theme")}>
        <ChoiceGroup
          value={settings.theme}
          onChange={(v) => void update({ theme: v as ThemeId })}
          options={[
            {
              value: "light",
              label: t("settings.themeLight"),
              icon: <IconSun className="size-3.5" />,
            },
            {
              value: "dark",
              label: t("settings.themeDark"),
              icon: <IconMoon className="size-3.5" />,
            },
            {
              value: "midnight",
              label: t("settings.themeMidnight"),
              icon: <IconSparkles className="size-3.5" />,
            },
          ]}
        />
      </Field>
      <Separator />
      <Field
        label={
          <span className="inline-flex items-center gap-1.5">
            <IconLanguage className="size-3.5 text-muted-foreground" />
            {t("settings.language")}
          </span>
        }
      >
        <ChoiceGroup
          value={settings.language}
          onChange={(v) => void update({ language: v as LanguageId })}
          options={[
            { value: "ru", label: t("settings.languageRu") },
            { value: "en", label: t("settings.languageEn") },
          ]}
        />
      </Field>
    </Panel>
  );
}

export function AgentSection() {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const modelFromAgent = useAgentStore((s) => s.model);

  return (
    <Panel
      icon={<IconRobot className="size-4" stroke={1.75} />}
      title={t("settings.agent")}
      description={t("settings.agentCardHint")}
    >
      <Field label={t("settings.permissionMode")}>
        <ChoiceGroup
          columns={200}
          value={settings.permissionMode}
          onChange={(v) => void update({ permissionMode: v as PermissionMode })}
          options={[
            {
              value: "ask",
              label: t("settings.permissionAsk"),
              hint: t("settings.permissionAskHint"),
            },
            {
              value: "auto",
              label: t("settings.permissionAuto"),
              hint: t("settings.permissionAutoHint"),
            },
          ]}
        />
      </Field>
      <Separator />
      <Field label={t("settings.defaultMode")} hint={t("settings.defaultModeHint")}>
        <ChoiceGroup
          value={settings.defaultAgentMode}
          onChange={(v) => void update({ defaultAgentMode: v as AgentMode })}
          options={[
            { value: "agent", label: t("chat.modeAgent") },
            { value: "plan", label: t("chat.modePlan") },
          ]}
        />
      </Field>
      <Separator />
      <Field
        label={t("settings.modelLabel")}
        hint={t("settings.modelLabelHint")}
      >
        <Input
          id="model-label"
          value={settings.modelLabel}
          placeholder={t("settings.modelPlaceholder")}
          onChange={(e) => void update({ modelLabel: e.target.value })}
        />
        <p className="settings-field__note">
          {t("settings.model")}:{" "}
          <span className="font-mono text-foreground">
            {modelFromAgent || settings.modelLabel || "—"}
          </span>
        </p>
      </Field>
    </Panel>
  );
}

export function ProvidersSection() {
  const { t } = useTranslation();
  const providers = useAgentStore((s) => s.providers);
  const refreshProviders = useAgentStore((s) => s.refreshProviders);

  useEffect(() => {
    // Credentials can change outside the app (editing .env in a terminal),
    // so re-read them every time the section mounts.
    void refreshProviders();
  }, [refreshProviders]);

  return (
    <Panel
      icon={<IconPlugConnected className="size-4" stroke={1.75} />}
      title={t("settings.providers")}
      description={t("settings.providersHint")}
    >
      {providers.length === 0 ? (
        <div className="settings-empty">{t("settings.providersLoading")}</div>
      ) : (
        <div className="provider-list">
          {providers.map((p) => (
            <div key={p.id} className="provider-item">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.label}</div>
                <p className="text-xs text-muted-foreground">
                  {!p.connected
                    ? t("settings.providerNotConnected")
                    : p.kind === "oauth"
                      ? t("settings.providerOauth")
                      : t("settings.providerApiKey")}
                </p>
              </div>
              <Badge
                variant={p.connected ? "default" : "outline"}
                className="h-6 shrink-0 px-2 font-normal"
              >
                {p.connected
                  ? t("settings.providerReady")
                  : t("settings.providerNone")}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <Separator />
      <p className="settings-field__note">{t("settings.providersFootnote")}</p>
    </Panel>
  );
}

export function PrivacySection() {
  const { t } = useTranslation();
  const reset = useSettingsStore((s) => s.reset);
  const resetOnboarding = useOnboardingStore((s) => s.reset);

  return (
    <Panel
      icon={<IconShield className="size-4" stroke={1.75} />}
      title={t("settings.privacy")}
      description={t("settings.privacyHint")}
    >
      <Row
        label={
          <span className="inline-flex items-center gap-1.5">
            <IconSparkles className="size-3.5 text-muted-foreground" />
            {t("settings.replayOnboarding")}
          </span>
        }
        hint={t("settings.replayOnboardingHint")}
        control={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => resetOnboarding()}
          >
            {t("settings.replayOnboardingAction")}
          </Button>
        }
      />
      <Separator />
      <Row
        label={t("settings.resetSettings")}
        hint={t("settings.resetSettingsHint")}
        control={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void reset()}
          >
            {t("settings.resetSettingsAction")}
          </Button>
        }
      />
    </Panel>
  );
}

export function CheckpointsSection() {
  const { t, i18n } = useTranslation();
  // Match ChatHistory/UsageSection: dates follow the app language, not the OS.
  const dateLocale = i18n.language === "ru" ? "ru-RU" : "en-US";
  const checkpoints = useSettingsStore((s) => s.checkpoints);
  const refreshCheckpoints = useSettingsStore((s) => s.refreshCheckpoints);
  const restoreCheckpoint = useSettingsStore((s) => s.restoreCheckpoint);

  useEffect(() => {
    void refreshCheckpoints();
  }, [refreshCheckpoints]);

  return (
    <Panel
      icon={<IconHistory className="size-4" stroke={1.75} />}
      title={t("settings.checkpoints")}
      description={t("settings.checkpointsHint")}
      action={
        <Badge variant="outline" className="h-6 px-2 font-normal tabular-nums">
          {checkpoints.length}
        </Badge>
      }
    >
      {checkpoints.length === 0 ? (
        <div className="settings-empty">{t("settings.noCheckpoints")}</div>
      ) : (
        <div className="checkpoint-list">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="checkpoint-item">
              <div className="checkpoint-item__meta">
                <strong>{cp.label || cp.id}</strong>
                <span>
                  {new Date(cp.createdAt).toLocaleString(dateLocale)} ·{" "}
                  {t("settings.filesCount", { count: cp.files.length })}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void restoreCheckpoint(cp.id)}
              >
                {t("settings.restore")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
