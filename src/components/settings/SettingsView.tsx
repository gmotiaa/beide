import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconBolt,
  IconHistory,
  IconLanguage,
  IconPalette,
  IconRobot,
  IconShield,
  IconSparkles,
  IconUserCircle,
} from "@tabler/icons-react";
import type {
  AgentMode,
  LanguageId,
  PermissionMode,
  ThemeId,
} from "../../lib/types";
import {
  PLANS,
  canSpend,
  formatResetAt,
  formatResetIn,
  msUntil,
  remainingPct,
  type UsagePlanId,
} from "../../lib/usage";
import { useSettingsStore } from "../../stores/settings";
import { useAgentStore } from "../../stores/agent";
import { useOnboardingStore } from "../../stores/onboarding";
import { useAuthStore } from "../../stores/auth";
import { useUsageStore } from "../../stores/usage";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { cn } from "../../lib/utils";

function isRuLocale(lang?: string): string {
  return lang?.startsWith("ru") ? "ru-RU" : "en-US";
}

function ChoiceGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="settings-choice-grid">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "settings-choice",
              active && "settings-choice--active",
            )}
          >
            <span className="settings-choice__label">{opt.label}</span>
            {opt.hint ? (
              <span className="settings-choice__hint">{opt.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Remaining % meter (token pool) */
function RemainingCard({
  title,
  remaining,
  resetLabel,
  detail,
}: {
  title: string;
  remaining: number;
  resetLabel: string;
  detail?: string;
}) {
  const empty = remaining <= 0.05;
  const low = remaining > 0 && remaining < 25;
  return (
    <div className="usage-limit-card">
      <div className="usage-limit-card__title">{title}</div>
      <div
        className={cn(
          "usage-limit-card__pct tabular-nums",
          empty && "is-empty",
          low && "is-low",
        )}
      >
        {Math.round(remaining)} %{" "}
        <span className="usage-limit-card__pct-label">осталось</span>
      </div>
      {detail ? (
        <div className="usage-limit-card__detail tabular-nums">{detail}</div>
      ) : null}
      <Progress
        value={remaining}
        className={cn(
          "usage-limit-card__bar w-full",
          empty && "[&_[data-slot=progress-indicator]]:bg-muted-foreground/30",
          !empty &&
            !low &&
            "[&_[data-slot=progress-indicator]]:bg-emerald-500",
          low && "[&_[data-slot=progress-indicator]]:bg-amber-500",
        )}
      />
      <div className="usage-limit-card__reset">Сброс {resetLabel}</div>
    </div>
  );
}

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const checkpoints = useSettingsStore((s) => s.checkpoints);
  const refreshCheckpoints = useSettingsStore((s) => s.refreshCheckpoints);
  const restoreCheckpoint = useSettingsStore((s) => s.restoreCheckpoint);
  const modelFromAgent = useAgentStore((s) => s.model);
  const resetOnboarding = useOnboardingStore((s) => s.reset);
  const user = useAuthStore((s) => s.user);
  const usageData = useUsageStore((s) => s.data);
  const usageSource = useUsageStore((s) => s.source);
  const accountEmail = useUsageStore((s) => s.accountEmail);
  const loadUsage = useUsageStore((s) => s.load);
  const setPlan = useUsageStore((s) => s.setPlan);
  const addCredits = useUsageStore((s) => s.addCredits);
  const resetToday = useUsageStore((s) => s.resetToday);

  useEffect(() => {
    void refreshCheckpoints();
    void loadUsage();
  }, [refreshCheckpoints, loadUsage]);

  const limits = PLANS[usageData.plan];
  const h5Left = remainingPct(usageData.h5.used, limits.tokens5h);
  const weekLeft = remainingPct(usageData.week.used, limits.tokensWeek);
  const gate = useMemo(() => canSpend(usageData, 48), [usageData]);
  const h5Reset = useMemo(
    () => formatResetAt(usageData.h5.endsAt, isRuLocale(i18n.language)),
    [usageData.h5.endsAt, i18n.language],
  );
  const weekReset = useMemo(
    () => formatResetAt(usageData.week.endsAt, isRuLocale(i18n.language)),
    [usageData.week.endsAt, i18n.language],
  );
  const h5In = useMemo(
    () => formatResetIn(msUntil(usageData.h5.endsAt)),
    [usageData.h5.endsAt, usageData.h5.used],
  );
  const isRu = i18n.language?.startsWith("ru");
  const fmtTok = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

  return (
    <div className="settings-view">
      <div className="settings-view__inner">
        <header className="settings-view__hero">
          <div className="flex items-start gap-3">
            <div className="settings-view__logo" aria-hidden>
              <img src="/icon.svg" alt="" className="size-10 rounded-[11px]" />
            </div>
            <div>
              <h1>{t("settings.title")}</h1>
              <p className="settings-view__lead">
                {isRu
                  ? "Внешний вид, агент, лимиты аккаунта и чекпоинты."
                  : "Appearance, agent, account limits, and checkpoints."}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="font-normal">
            beide
          </Badge>
        </header>

        <div className="settings-grid">
          {/* Token usage panel */}
          <Card
            size="sm"
            className="settings-card settings-card--wide settings-card--usage"
          >
            <CardHeader className="gap-1 border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {t("settings.usagePanel")}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {t("settings.usageHint")}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={usageSource === "supabase" ? "default" : "outline"}
                    className="h-6 px-2 font-normal"
                  >
                    {usageSource === "supabase"
                      ? "Supabase"
                      : t("settings.localAccount")}
                  </Badge>
                  <Badge
                    variant={usageData.plan === "pro" ? "default" : "outline"}
                    className="h-6 px-2.5 font-semibold tracking-wide uppercase"
                  >
                    {limits.label}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-5">
              {usageSource !== "supabase" && (
                <div className="usage-limit-banner usage-limit-banner--info">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {t("settings.cloudBillingHintTitle")}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("settings.cloudBillingHintBody")}
                    </p>
                  </div>
                </div>
              )}

              {!gate.ok && (
                <div className="usage-limit-banner">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {t("settings.limitReached")}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {gate.reason ?? t("settings.limitReachedHint")}{" "}
                      {t("settings.resetIn", { time: h5In })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void setPlan("pro")}
                    >
                      Pro
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void loadUsage()}
                    >
                      {t("settings.refresh")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="usage-account">
                <div className="usage-account__left">
                  <IconUserCircle
                    className="size-8 text-muted-foreground"
                    stroke={1.5}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {accountEmail ?? user?.email ?? t("settings.localAccount")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {usageSource === "supabase"
                        ? t("settings.signedInCloud")
                        : user
                          ? t("settings.signedIn")
                          : t("settings.localAccountHint")}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold tracking-tight">
                  {t("settings.balance")}
                </h3>
                <div className="usage-limit-grid">
                  <RemainingCard
                    title={t("settings.limit5h")}
                    remaining={h5Left}
                    resetLabel={h5Reset}
                    detail={`${fmtTok(usageData.h5.used)} / ${fmtTok(limits.tokens5h)} tok`}
                  />
                  <RemainingCard
                    title={t("settings.limitWeek")}
                    remaining={weekLeft}
                    resetLabel={weekReset}
                    detail={`${fmtTok(usageData.week.used)} / ${fmtTok(limits.tokensWeek)} tok`}
                  />
                  <div className="usage-limit-card">
                    <div className="usage-limit-card__title">
                      {t("settings.creditsLeft")}
                    </div>
                    <div className="usage-limit-card__pct tabular-nums">
                      {fmtTok(usageData.credits)}
                      <span className="usage-limit-card__pct-label"> tok</span>
                    </div>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {t("settings.creditsHint")}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-auto w-fit"
                      onClick={() => void addCredits(10_000)}
                    >
                      {t("settings.addCredits")}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <Label>{t("settings.plan")}</Label>
                <div className="settings-choice-grid">
                  {(Object.keys(PLANS) as UsagePlanId[]).map((id) => {
                    const plan = PLANS[id];
                    const active = usageData.plan === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={cn(
                          "settings-choice settings-choice--plan",
                          active && "settings-choice--active",
                        )}
                        onClick={() => void setPlan(id)}
                      >
                        <span className="settings-choice__label flex items-center gap-1.5">
                          {plan.label}
                          {id === "pro" ? (
                            <IconSparkles className="size-3.5 text-primary" />
                          ) : null}
                        </span>
                        <span className="settings-choice__hint">
                          {fmtTok(plan.tokens5h)} / 5ч · {fmtTok(plan.tokensWeek)}{" "}
                          / нед
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void resetToday()}
                >
                  {t("settings.resetUsage")}
                </Button>
                <p className="self-center text-[11px] text-muted-foreground">
                  {t("settings.resetUsageHint")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="settings-card">
            <CardHeader className="gap-1">
              <div className="settings-card__icon">
                <IconPalette className="size-4" stroke={1.75} />
              </div>
              <CardTitle>{t("settings.appearance")}</CardTitle>
              <CardDescription>Тема и язык интерфейса</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t("settings.theme")}</Label>
                <ChoiceGroup
                  value={settings.theme}
                  onChange={(v) => void update({ theme: v as ThemeId })}
                  options={[
                    { value: "light", label: t("settings.themeLight") },
                    { value: "dark", label: t("settings.themeDark") },
                    { value: "midnight", label: t("settings.themeMidnight") },
                  ]}
                />
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label className="flex items-center gap-1.5">
                  <IconLanguage className="size-3.5 text-muted-foreground" />
                  {t("settings.language")}
                </Label>
                <ChoiceGroup
                  value={settings.language}
                  onChange={(v) => void update({ language: v as LanguageId })}
                  options={[
                    { value: "ru", label: t("settings.languageRu") },
                    { value: "en", label: t("settings.languageEn") },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="settings-card">
            <CardHeader className="gap-1">
              <div className="settings-card__icon">
                <IconRobot className="size-4" stroke={1.75} />
              </div>
              <CardTitle>{t("settings.agent")}</CardTitle>
              <CardDescription>
                Права, режим по умолчанию и метка модели
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>{t("settings.permissionMode")}</Label>
                <ChoiceGroup
                  value={settings.permissionMode}
                  onChange={(v) =>
                    void update({ permissionMode: v as PermissionMode })
                  }
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
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label>{t("settings.defaultMode")}</Label>
                <ChoiceGroup
                  value={settings.defaultAgentMode}
                  onChange={(v) =>
                    void update({ defaultAgentMode: v as AgentMode })
                  }
                  options={[
                    { value: "agent", label: t("chat.modeAgent") },
                    { value: "plan", label: t("chat.modePlan") },
                  ]}
                />
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <Label htmlFor="model-label">{t("settings.modelLabel")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.model")}:{" "}
                  <span className="font-mono text-foreground">
                    {modelFromAgent || settings.modelLabel || "—"}
                  </span>
                </p>
                <Input
                  id="model-label"
                  value={settings.modelLabel}
                  placeholder={t("settings.modelPlaceholder")}
                  onChange={(e) => void update({ modelLabel: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="settings-card">
            <CardHeader className="gap-1">
              <div className="settings-card__icon">
                <IconShield className="size-4" stroke={1.75} />
              </div>
              <CardTitle>{t("settings.privacy")}</CardTitle>
              <CardDescription>Телеметрия и подсказки</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {t("settings.telemetry")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.telemetryHint")}
                  </p>
                </div>
                <Switch
                  checked={settings.telemetryEnabled}
                  onCheckedChange={(checked) =>
                    void update({ telemetryEnabled: checked })
                  }
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <IconSparkles className="size-3.5 text-muted-foreground" />
                    {t("settings.replayOnboarding")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.replayOnboardingHint")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => resetOnboarding()}
                >
                  {t("settings.replayOnboardingAction")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card size="sm" className="settings-card settings-card--wide">
            <CardHeader className="gap-1">
              <div className="settings-card__icon">
                <IconHistory className="size-4" stroke={1.75} />
              </div>
              <CardTitle>{t("settings.checkpoints")}</CardTitle>
              <CardDescription>
                Снимки перед write/edit — можно откатить
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checkpoints.length === 0 ? (
                <div className="settings-empty">{t("settings.noCheckpoints")}</div>
              ) : (
                <div className="checkpoint-list">
                  {checkpoints.map((cp) => (
                    <div key={cp.id} className="checkpoint-item">
                      <div className="checkpoint-item__meta">
                        <strong>{cp.label || cp.id}</strong>
                        <span>
                          {new Date(cp.createdAt).toLocaleString()} ·{" "}
                          {cp.files.length} files
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
