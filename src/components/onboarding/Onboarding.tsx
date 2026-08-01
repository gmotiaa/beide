import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconFolder,
  IconMap2,
  IconRobot,
  IconShieldCheck,
  IconSparkles,
  IconTerminal2,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { Spinner } from "../ui/spinner";
import { cn } from "../../lib/utils";
import { useOnboardingStore } from "../../stores/onboarding";
import { useAuthStore } from "../../stores/auth";
import { useSettingsStore } from "../../stores/settings";
import type { ThemeId, LanguageId, PermissionMode } from "../../lib/types";
import { AccountForm } from "./AccountForm";

const STEPS = ["welcome", "features", "settings", "account"] as const;
type Step = (typeof STEPS)[number];

function ChoicePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/20"
          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function Onboarding() {
  // Labels must be resolved inside the render (not module-level constants):
  // the language switch on the settings step re-renders this component and
  // every string below picks up the new locale immediately.
  const { t } = useTranslation();
  const step = useOnboardingStore((s) => s.step);
  const setStep = useOnboardingStore((s) => s.setStep);
  const complete = useOnboardingStore((s) => s.complete);

  const signOut = useAuthStore((s) => s.signOut);
  const clearError = useAuthStore((s) => s.clearError);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const authReady = useAuthStore((s) => s.ready);

  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const [signingOut, setSigningOut] = useState(false);

  const idx = Math.max(0, STEPS.indexOf(step as Step));
  const progress = ((idx + 1) / STEPS.length) * 100;
  const currentStep = STEPS[idx] ?? "welcome";

  const stepLabels: Record<Step, string> = {
    welcome: t("onboarding.stepWelcome"),
    features: t("onboarding.stepFeatures"),
    settings: t("onboarding.stepSettings"),
    account: t("onboarding.stepAccount"),
  };

  const features = [
    {
      icon: IconMap2,
      title: t("onboarding.featurePlanTitle"),
      body: t("onboarding.featurePlanBody"),
      chip: "readonly",
    },
    {
      icon: IconRobot,
      title: t("onboarding.featureAgentTitle"),
      body: t("onboarding.featureAgentBody"),
      chip: "tools",
    },
    {
      icon: IconFolder,
      title: t("onboarding.featureContextTitle"),
      body: t("onboarding.featureContextBody"),
      chip: "context",
    },
  ] as const;

  const next = () => {
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!);
  };
  const back = () => {
    if (idx > 0) setStep(STEPS[idx - 1]!);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      clearError();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div
      className="onboarding"
      role="dialog"
      aria-modal="true"
      aria-label={t("onboarding.ariaLabel")}
    >
      <div className="onboarding__bg" aria-hidden>
        <div className="onboarding__orb onboarding__orb--a" />
        <div className="onboarding__orb onboarding__orb--b" />
        <div className="onboarding__grid" />
      </div>

      <div className="onboarding__frame">
        <aside className="onboarding__aside">
          <div className="onboarding__aside-top">
            <div className="onboarding__logo-row">
              <div className="onboarding__mark" aria-hidden>
                b
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="onboarding__wordmark">beide</div>
                <Badge className="w-fit gap-1 font-normal">
                  <IconSparkles className="size-3" stroke={2} />
                  AI IDE · BY
                </Badge>
              </div>
            </div>

            <h2 className="onboarding__headline">
              {t("onboarding.headlineTop")}
              <br />
              <span>{t("onboarding.headlineAccent")}</span>
            </h2>
            <p className="onboarding__sub">{t("onboarding.sub")}</p>
          </div>

          <div className="onboarding__aside-stats">
            <Card size="sm" className="onboarding__stat-card">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="onboarding__stat-icon">
                  <IconTerminal2 className="size-4" stroke={1.75} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm">pi · GPT · Claude · Gemini</CardTitle>
                  <CardDescription>
                    {t("onboarding.statAgentDesc")}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            <Card size="sm" className="onboarding__stat-card">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="onboarding__stat-icon">
                  <IconShieldCheck className="size-4" stroke={1.75} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm">ask / auto</CardTitle>
                  <CardDescription>
                    {t("onboarding.statPermissionsDesc")}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </aside>

        <Card className="onboarding__panel border-0 shadow-lg ring-1 ring-foreground/10">
          <CardHeader className="gap-3 border-b border-border pb-4">
            <div className="onboarding__steps">
              {STEPS.map((s, i) => {
                const active = i === idx;
                const done = i < idx;
                return (
                  <button
                    key={s}
                    type="button"
                    className={cn(
                      "onboarding__step-chip",
                      active && "is-active",
                      done && "is-done",
                    )}
                    onClick={() => {
                      if (done || active) setStep(s);
                    }}
                    disabled={!done && !active}
                  >
                    <span className="onboarding__step-num">{i + 1}</span>
                    <span className="onboarding__step-label">
                      {stepLabels[s]}
                    </span>
                  </button>
                );
              })}
            </div>
            <Progress value={progress} className="w-full" />
          </CardHeader>

          <div className="onboarding__body">
            {currentStep === "welcome" && (
              <section className="onboarding__section">
                <Badge variant="secondary" className="w-fit font-normal">
                  {t("onboarding.badgeWelcome")}
                </Badge>
                <h1>{t("onboarding.welcomeTitle")}</h1>
                <p className="onboarding__lead">{t("onboarding.welcomeLead")}</p>

                <div className="onboarding__hero-cards">
                  <Card size="sm" className="onboarding__hero-card">
                    <CardHeader className="gap-1">
                      <CardTitle>{t("onboarding.heroWindowsTitle")}</CardTitle>
                      <CardDescription>
                        {t("onboarding.heroWindowsBody")}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card size="sm" className="onboarding__hero-card">
                    <CardHeader className="gap-1">
                      <CardTitle>{t("onboarding.heroNoMarketTitle")}</CardTitle>
                      <CardDescription>
                        {t("onboarding.heroNoMarketBody")}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </section>
            )}

            {currentStep === "features" && (
              <section className="onboarding__section">
                <Badge variant="secondary" className="w-fit font-normal">
                  {t("onboarding.badgeFeatures")}
                </Badge>
                <h1>{t("onboarding.featuresTitle")}</h1>
                <p className="onboarding__lead">
                  {t("onboarding.featuresLead")}
                </p>

                <div className="onboarding__feature-grid">
                  {features.map((f) => (
                    <Card key={f.chip} size="sm" className="onboarding__feature-card">
                      <CardHeader className="gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="onboarding__feature-icon">
                            <f.icon className="size-5" stroke={1.6} />
                          </div>
                          <Badge variant="outline" className="font-normal">
                            {f.chip}
                          </Badge>
                        </div>
                        <CardTitle>{f.title}</CardTitle>
                        <CardDescription>{f.body}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {currentStep === "settings" && (
              <section className="onboarding__section">
                <Badge variant="secondary" className="w-fit font-normal">
                  {t("onboarding.badgeSettings")}
                </Badge>
                <h1>{t("onboarding.settingsTitle")}</h1>
                <p className="onboarding__lead">
                  {t("onboarding.settingsLead")}
                </p>

                <div className="onboarding__fields">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">
                      {t("onboarding.theme")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("onboarding.themeHint")}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["light", t("settings.themeLight")],
                          ["dark", t("settings.themeDark")],
                          ["midnight", t("settings.themeMidnight")],
                        ] as const
                      ).map(([value, label]) => (
                        <ChoicePill
                          key={value}
                          active={settings.theme === value}
                          onClick={() =>
                            void updateSettings({ theme: value as ThemeId })
                          }
                        >
                          {label}
                        </ChoicePill>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">
                      {t("settings.language")}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <ChoicePill
                        active={settings.language === "ru"}
                        onClick={() =>
                          void updateSettings({ language: "ru" as LanguageId })
                        }
                      >
                        {t("settings.languageRu")}
                      </ChoicePill>
                      <ChoicePill
                        active={settings.language === "en"}
                        onClick={() =>
                          void updateSettings({ language: "en" as LanguageId })
                        }
                      >
                        {t("settings.languageEn")}
                      </ChoicePill>
                      <ChoicePill
                        active={settings.language === "be"}
                        onClick={() =>
                          void updateSettings({ language: "be" as LanguageId })
                        }
                      >
                        {t("settings.languageBe")}
                      </ChoicePill>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">
                      {t("onboarding.permissions")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("onboarding.permissionsHint")}
                    </p>
                    <div className="flex flex-col gap-2">
                      <ChoicePill
                        active={settings.permissionMode === "ask"}
                        onClick={() =>
                          void updateSettings({
                            permissionMode: "ask" as PermissionMode,
                          })
                        }
                      >
                        <div className="font-medium text-foreground">
                          {t("onboarding.permissionAskTitle")}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t("onboarding.permissionAskHint")}
                        </div>
                      </ChoicePill>
                      <ChoicePill
                        active={settings.permissionMode === "auto"}
                        onClick={() =>
                          void updateSettings({
                            permissionMode: "auto" as PermissionMode,
                          })
                        }
                      >
                        <div className="font-medium text-foreground">
                          {t("onboarding.permissionAutoTitle")}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {t("onboarding.permissionAutoHint")}
                        </div>
                      </ChoicePill>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {currentStep === "account" && (
              <section className="onboarding__section">
                <Badge variant="secondary" className="w-fit font-normal">
                  {t("onboarding.badgeAccount")}
                </Badge>
                <h1>{t("onboarding.accountTitle")}</h1>
                <p className="onboarding__lead">{t("onboarding.accountLead")}</p>

                {!authReady ? (
                  <div className="onboarding__center">
                    <Spinner size="lg" />
                  </div>
                ) : user && session ? (
                  <Card size="sm">
                    <CardHeader className="flex-row items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {(user.email?.[0] ?? "u").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {user.email}
                        </CardTitle>
                        <CardDescription>
                          {t("onboarding.sessionRestored")}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => complete()}>
                        {t("onboarding.continue")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={signingOut}
                        onClick={() => void handleSignOut()}
                      >
                        {signingOut ? "…" : t("onboarding.signOutSwitch")}
                      </Button>
                    </CardFooter>
                  </Card>
                ) : (
                  <AccountForm onAuthenticated={() => complete()} />
                )}
              </section>
            )}
          </div>

          <footer className="onboarding__footer">
            {/* No skip on the account step: the account is mandatory — usage
                limits and the provider key are served per-account. */}
            {idx > 0 ? (
              <Button type="button" variant="ghost" onClick={back}>
                {t("onboarding.back")}
              </Button>
            ) : (
              <span />
            )}

            <div className="onboarding__footer-right">
              {currentStep !== "account" && (
                <Button type="button" size="lg" onClick={next}>
                  {t("onboarding.next")}
                </Button>
              )}
            </div>
          </footer>
        </Card>
      </div>
    </div>
  );
}
