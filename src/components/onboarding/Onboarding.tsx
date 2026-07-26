import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconAt,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconFolder,
  IconFolderOpen,
  IconGauge,
  IconLanguage,
  IconMap2,
  IconMoon,
  IconRobot,
  IconShieldCheck,
  IconSparkles,
  IconSun,
  IconTerminal2,
  IconWand,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Spinner } from "../ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../../lib/utils";
import { useOnboardingStore } from "../../stores/onboarding";
import { useAuthStore } from "../../stores/auth";
import { useSettingsStore } from "../../stores/settings";
import { useWorkspaceStore } from "../../stores/workspace";
import type { ThemeId, LanguageId, PermissionMode } from "../../lib/types";

const STEPS = ["welcome", "features", "settings", "account", "ready"] as const;
type Step = (typeof STEPS)[number];

/**
 * Enter advances the wizard, but only when nothing on screen already owns it:
 * fields submit their form and a focused control activates itself.
 */
function ownsEnter(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return Boolean(
    el.closest(
      'input, textarea, select, button, a[href], [role="button"], [contenteditable=""], [contenteditable="true"]',
    ),
  );
}

/**
 * A miniature IDE painted in one of the three palettes. `data-palette` scopes
 * the palette block from themes.css to this subtree, so the swatch shows the
 * real colours of a theme the app is not currently wearing — no hex here.
 */
function ThemeSwatch({ palette }: { palette: ThemeId }) {
  return (
    <span className="theme-swatch" data-palette={palette} aria-hidden>
      <span className="theme-swatch__bar">
        <i />
        <i />
        <i />
      </span>
      <span className="theme-swatch__body">
        <span className="theme-swatch__side">
          <i />
          <i />
          <i />
        </span>
        <span className="theme-swatch__main">
          <i />
          <i className="is-accent" />
          <i />
        </span>
      </span>
    </span>
  );
}

function Choice({
  active,
  onClick,
  icon,
  title,
  hint,
  media,
  className,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  media?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("onb-choice", active && "is-active", className)}
    >
      {media}
      <span className="onb-choice__row">
        {icon ? (
          <span className="onb-choice__icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="onb-choice__title">{title}</span>
        <span className="onb-choice__check" aria-hidden>
          <IconCheck className="size-3" stroke={2.5} />
        </span>
      </span>
      {hint ? <span className="onb-choice__hint">{hint}</span> : null}
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

  const configured = useAuthStore((s) => s.configured);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const resendSignupOtp = useAuthStore((s) => s.resendSignupOtp);
  const pendingVerifyEmail = useAuthStore((s) => s.pendingVerifyEmail);
  const clearPendingVerify = useAuthStore((s) => s.clearPendingVerify);
  const authError = useAuthStore((s) => s.error);
  const authLoading = useAuthStore((s) => s.loading);
  const clearError = useAuthStore((s) => s.clearError);
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const authReady = useAuthStore((s) => s.ready);

  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const rootPath = useWorkspaceStore((s) => s.rootPath);
  const openFolder = useWorkspaceStore((s) => s.openFolder);
  const workspaceLoading = useWorkspaceStore((s) => s.loading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [signingOut, setSigningOut] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpComplete, setOtpComplete] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  const idx = Math.max(0, STEPS.indexOf(step as Step));
  const currentStep = STEPS[idx] ?? "welcome";
  const progress = ((idx + 1) / STEPS.length) * 100;
  const signedIn = Boolean(user && session);

  const stepMeta: Record<Step, { label: string; hint: string }> = {
    welcome: {
      label: t("onboarding.stepWelcome"),
      hint: t("onboarding.stepWelcomeHint"),
    },
    features: {
      label: t("onboarding.stepFeatures"),
      hint: t("onboarding.stepFeaturesHint"),
    },
    settings: {
      label: t("onboarding.stepSettings"),
      hint: t("onboarding.stepSettingsHint"),
    },
    account: {
      label: t("onboarding.stepAccount"),
      hint: t("onboarding.stepAccountHint"),
    },
    ready: {
      label: t("onboarding.stepReady"),
      hint: t("onboarding.stepReadyHint"),
    },
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

  const themeOptions: Array<{ value: ThemeId; label: string; hint: string }> = [
    {
      value: "light",
      label: t("settings.themeLight"),
      hint: t("onboarding.themeLightHint"),
    },
    {
      value: "dark",
      label: t("settings.themeDark"),
      hint: t("onboarding.themeDarkHint"),
    },
    {
      value: "midnight",
      label: t("settings.themeMidnight"),
      hint: t("onboarding.themeMidnightHint"),
    },
  ];

  useEffect(() => {
    clearError();
  }, [authMode, clearError]);

  useEffect(() => {
    if (pendingVerifyEmail) {
      setOtpOpen(true);
      setEmail(pendingVerifyEmail);
    }
  }, [pendingVerifyEmail]);

  const next = () => {
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!);
  };
  const back = () => {
    if (idx > 0) setStep(STEPS[idx - 1]!);
  };

  // Enter walks the wizard forward while the user is not typing; the last step
  // finishes it. The OTP dialog owns Enter for itself, so it is excluded.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || otpOpen) return;
      if (ownsEnter(e.target)) return;
      e.preventDefault();
      if (currentStep === "ready") complete();
      else if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentStep, idx, otpOpen, complete, setStep]);

  const submitAuth = async () => {
    if (authMode === "login") {
      const ok = await signIn(email.trim(), password);
      // Signing in is not the finish line any more — the last step hands the
      // user a workspace, so land there instead of dropping straight into the
      // empty IDE.
      if (ok) setStep("ready");
      return;
    }
    const result = await signUp(email.trim(), password);
    if (!result.ok) return;
    if (result.needsVerification) {
      setOtp("");
      setOtpComplete(false);
      setOtpOpen(true);
      return;
    }
    setStep("ready");
  };

  const submitOtp = async () => {
    const mail = pendingVerifyEmail || email.trim();
    if (!mail || otp.length < 6) return;
    const ok = await verifyEmailOtp(mail, otp);
    if (ok) {
      setOtpOpen(false);
      setStep("ready");
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      setEmail("");
      setPassword("");
      clearError();
    } finally {
      setSigningOut(false);
    }
  };

  const shortPath = rootPath
    ? rootPath.replace(/\\/g, "/").split("/").filter(Boolean).slice(-2).join("/")
    : null;

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
        <div className="onboarding__veil" />
      </div>

      <div className="onboarding__frame">
        <aside className="onboarding__aside">
          <div className="onboarding__brand">
            <div className="onboarding__mark" aria-hidden>
              b
            </div>
            <div className="onboarding__brand-text">
              <div className="onboarding__wordmark">beide</div>
              <Badge variant="secondary" className="w-fit gap-1 font-normal">
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

          {/* The rail is the real progress indicator on wide screens; the panel
              header keeps a compact bar for when the aside is hidden. */}
          <ol className="onboarding__rail">
            {STEPS.map((s, i) => {
              const active = i === idx;
              const done = i < idx;
              return (
                <li key={s}>
                  <button
                    type="button"
                    className={cn(
                      "onboarding__rail-step",
                      active && "is-active",
                      done && "is-done",
                    )}
                    disabled={!done && !active}
                    aria-current={active ? "step" : undefined}
                    onClick={() => {
                      if (done || active) setStep(s);
                    }}
                  >
                    <span className="onboarding__rail-dot" aria-hidden>
                      {done ? (
                        <IconCheck className="size-3" stroke={3} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="onboarding__rail-text">
                      <span className="onboarding__rail-label">
                        {stepMeta[s].label}
                      </span>
                      <span className="onboarding__rail-hint">
                        {stepMeta[s].hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="onboarding__note">{t("onboarding.localNote")}</p>
        </aside>

        <section className="onboarding__panel">
          <header className="onboarding__panel-head">
            <div className="onboarding__panel-head-row">
              <span className="onboarding__counter">
                {t("onboarding.stepCounter", {
                  current: idx + 1,
                  total: STEPS.length,
                })}
              </span>
              <span className="onboarding__panel-step">
                {stepMeta[currentStep].label}
              </span>
            </div>
            <div
              className="onboarding__progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </header>

          <div className="onboarding__body" key={currentStep}>
            {currentStep === "welcome" && (
              <div className="onboarding__section">
                <h1>{t("onboarding.welcomeTitle")}</h1>
                <p className="onboarding__lead">{t("onboarding.welcomeLead")}</p>

                <div className="onboarding__hero-cards">
                  <article className="onb-card">
                    <div className="onb-card__icon" aria-hidden>
                      <IconTerminal2 className="size-4" stroke={1.75} />
                    </div>
                    <h3>{t("onboarding.heroWindowsTitle")}</h3>
                    <p>{t("onboarding.heroWindowsBody")}</p>
                  </article>
                  <article className="onb-card">
                    <div className="onb-card__icon" aria-hidden>
                      <IconWand className="size-4" stroke={1.75} />
                    </div>
                    <h3>{t("onboarding.heroNoMarketTitle")}</h3>
                    <p>{t("onboarding.heroNoMarketBody")}</p>
                  </article>
                </div>

                <ul className="onboarding__list">
                  <li>{t("onboarding.welcomePoint1")}</li>
                  <li>{t("onboarding.welcomePoint2")}</li>
                  <li>{t("onboarding.welcomePoint3")}</li>
                </ul>
              </div>
            )}

            {currentStep === "features" && (
              <div className="onboarding__section">
                <h1>{t("onboarding.featuresTitle")}</h1>
                <p className="onboarding__lead">
                  {t("onboarding.featuresLead")}
                </p>

                <div className="onboarding__feature-grid">
                  {features.map((f) => (
                    <article key={f.chip} className="onb-feature">
                      <div className="onb-feature__icon" aria-hidden>
                        <f.icon className="size-5" stroke={1.6} />
                      </div>
                      <div className="onb-feature__text">
                        <div className="onb-feature__title-row">
                          <h3>{f.title}</h3>
                          <Badge variant="outline" className="font-normal">
                            {f.chip}
                          </Badge>
                        </div>
                        <p>{f.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {currentStep === "settings" && (
              <div className="onboarding__section">
                <h1>{t("onboarding.settingsTitle")}</h1>
                <p className="onboarding__lead">
                  {t("onboarding.settingsLead")}
                </p>

                <div className="onboarding__fields">
                  <div className="onboarding__field">
                    <div className="onboarding__field-head">
                      <IconSun className="size-3.5" stroke={1.75} />
                      <span>{t("onboarding.theme")}</span>
                      <em>{t("onboarding.themeHint")}</em>
                    </div>
                    <div className="onboarding__theme-grid">
                      {themeOptions.map((option) => (
                        <Choice
                          key={option.value}
                          className="onb-choice--theme"
                          active={settings.theme === option.value}
                          onClick={() =>
                            void updateSettings({ theme: option.value })
                          }
                          icon={
                            option.value === "light" ? (
                              <IconSun className="size-3.5" stroke={1.75} />
                            ) : option.value === "dark" ? (
                              <IconMoon className="size-3.5" stroke={1.75} />
                            ) : (
                              <IconSparkles className="size-3.5" stroke={1.75} />
                            )
                          }
                          title={option.label}
                          hint={option.hint}
                          media={<ThemeSwatch palette={option.value} />}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="onboarding__field">
                    <div className="onboarding__field-head">
                      <IconLanguage className="size-3.5" stroke={1.75} />
                      <span>{t("settings.language")}</span>
                    </div>
                    <div className="onboarding__pair">
                      {(
                        [
                          ["ru", t("settings.languageRu")],
                          ["en", t("settings.languageEn")],
                        ] as const
                      ).map(([value, label]) => (
                        <Choice
                          key={value}
                          active={settings.language === value}
                          onClick={() =>
                            void updateSettings({ language: value as LanguageId })
                          }
                          title={label}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="onboarding__field">
                    <div className="onboarding__field-head">
                      <IconShieldCheck className="size-3.5" stroke={1.75} />
                      <span>{t("onboarding.permissions")}</span>
                      <em>{t("onboarding.permissionsHint")}</em>
                    </div>
                    <div className="onboarding__pair">
                      <Choice
                        active={settings.permissionMode === "ask"}
                        onClick={() =>
                          void updateSettings({
                            permissionMode: "ask" as PermissionMode,
                          })
                        }
                        icon={<IconShieldCheck className="size-3.5" stroke={1.75} />}
                        title={t("onboarding.permissionAskTitle")}
                        hint={t("onboarding.permissionAskHint")}
                      />
                      <Choice
                        active={settings.permissionMode === "auto"}
                        onClick={() =>
                          void updateSettings({
                            permissionMode: "auto" as PermissionMode,
                          })
                        }
                        icon={<IconGauge className="size-3.5" stroke={1.75} />}
                        title={t("onboarding.permissionAutoTitle")}
                        hint={t("onboarding.permissionAutoHint")}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "account" && (
              <div className="onboarding__section">
                <h1>{t("onboarding.accountTitle")}</h1>
                <p className="onboarding__lead">{t("onboarding.accountLead")}</p>

                {!authReady ? (
                  <div className="onboarding__center">
                    <Spinner size="lg" />
                  </div>
                ) : signedIn ? (
                  <div className="onb-account">
                    <Avatar>
                      <AvatarFallback>
                        {(user?.email?.[0] ?? "u").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="onb-account__text">
                      <strong>{user?.email}</strong>
                      <span>{t("onboarding.sessionRestored")}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={signingOut}
                      onClick={() => void handleSignOut()}
                    >
                      {signingOut ? "…" : t("onboarding.signOutSwitch")}
                    </Button>
                  </div>
                ) : (
                  <>
                    {!configured && (
                      <Alert variant="warning">
                        <IconAlertTriangle stroke={1.75} />
                        <AlertTitle>
                          {t("onboarding.supabaseNotConfigured")}
                        </AlertTitle>
                        <AlertDescription>
                          {t("onboarding.supabaseNotConfiguredHint")}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Tabs
                      value={authMode}
                      onValueChange={(v) =>
                        setAuthMode(String(v) as "login" | "register")
                      }
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="login">
                          {t("onboarding.signIn")}
                        </TabsTrigger>
                        <TabsTrigger value="register">
                          {t("onboarding.signUp")}
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <form
                      className="onboarding__form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void submitAuth();
                      }}
                    >
                      <div className="onboarding__form-field">
                        <Label htmlFor="onboarding-email">
                          {t("onboarding.email")}
                        </Label>
                        <div className="onboarding__input-wrap">
                          <IconAt
                            className="onboarding__input-icon size-4"
                            stroke={1.75}
                            aria-hidden
                          />
                          <Input
                            id="onboarding-email"
                            name="email"
                            type="email"
                            className="pl-9"
                            value={email}
                            autoComplete="email"
                            placeholder="you@example.com"
                            disabled={!configured || authLoading}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="onboarding__form-field">
                        <Label htmlFor="onboarding-password">
                          {t("onboarding.password")}
                        </Label>
                        <div className="onboarding__input-wrap">
                          <Input
                            id="onboarding-password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            className="pr-10"
                            value={password}
                            autoComplete={
                              authMode === "login"
                                ? "current-password"
                                : "new-password"
                            }
                            placeholder={t("onboarding.passwordPlaceholder")}
                            disabled={!configured || authLoading}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            className="onboarding__input-toggle"
                            aria-label={
                              showPassword
                                ? t("onboarding.passwordHide")
                                : t("onboarding.passwordShow")
                            }
                            onClick={() => setShowPassword((v) => !v)}
                          >
                            {showPassword ? (
                              <IconEyeOff className="size-4" stroke={1.75} />
                            ) : (
                              <IconEye className="size-4" stroke={1.75} />
                            )}
                          </button>
                        </div>
                      </div>

                      {authError && (
                        <Alert variant="destructive">
                          <IconAlertCircle stroke={1.75} />
                          <AlertTitle>{t("onboarding.authFailed")}</AlertTitle>
                          <AlertDescription>{authError}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        size="lg"
                        disabled={
                          !configured ||
                          authLoading ||
                          !email ||
                          password.length < 6
                        }
                      >
                        {authLoading ? <Spinner size="sm" /> : null}
                        {authMode === "login"
                          ? t("onboarding.signInAndStart")
                          : t("onboarding.signUpAndStart")}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            )}

            {currentStep === "ready" && (
              <div className="onboarding__section">
                <h1>{t("onboarding.readyTitle")}</h1>
                <p className="onboarding__lead">{t("onboarding.readyLead")}</p>

                <div
                  className={cn(
                    "onb-workspace",
                    rootPath && "is-picked",
                  )}
                >
                  <div className="onb-workspace__icon" aria-hidden>
                    <IconFolderOpen className="size-5" stroke={1.6} />
                  </div>
                  <div className="onb-workspace__text">
                    <strong>
                      {rootPath
                        ? shortPath
                        : t("onboarding.workspaceEmptyTitle")}
                    </strong>
                    <span
                      className={rootPath ? "is-path" : undefined}
                      title={rootPath ?? undefined}
                    >
                      {rootPath ?? t("onboarding.workspaceEmptyHint")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant={rootPath ? "outline" : "default"}
                    disabled={workspaceLoading}
                    onClick={() => void openFolder()}
                  >
                    {workspaceLoading ? <Spinner size="sm" /> : null}
                    {rootPath
                      ? t("onboarding.workspaceChange")
                      : t("common.openFolder")}
                  </Button>
                </div>

                <div className="onboarding__summary">
                  <span className="onboarding__summary-item">
                    <IconSun className="size-3.5" stroke={1.75} />
                    {settings.theme === "light"
                      ? t("settings.themeLight")
                      : settings.theme === "dark"
                        ? t("settings.themeDark")
                        : t("settings.themeMidnight")}
                  </span>
                  <span className="onboarding__summary-item">
                    <IconLanguage className="size-3.5" stroke={1.75} />
                    {settings.language === "ru"
                      ? t("settings.languageRu")
                      : t("settings.languageEn")}
                  </span>
                  <span className="onboarding__summary-item">
                    <IconShieldCheck className="size-3.5" stroke={1.75} />
                    {settings.permissionMode === "ask"
                      ? t("onboarding.permissionAskTitle")
                      : t("onboarding.permissionAutoTitle")}
                  </span>
                  <span className="onboarding__summary-item">
                    <IconRobot className="size-3.5" stroke={1.75} />
                    {signedIn
                      ? (user?.email ?? t("onboarding.accountSignedIn"))
                      : t("onboarding.accountLocal")}
                  </span>
                </div>

                <p className="onboarding__hint-line">
                  {t("onboarding.readyShortcuts")}
                </p>
              </div>
            )}
          </div>

          <footer className="onboarding__footer">
            {idx > 0 ? (
              <Button type="button" variant="ghost" onClick={back}>
                {t("onboarding.back")}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => complete()}>
                {t("onboarding.skipAll")}
              </Button>
            )}

            <div className="onboarding__footer-right">
              {currentStep === "ready" ? (
                <Button type="button" size="lg" onClick={() => complete()}>
                  {t("onboarding.finish")}
                  <IconArrowRight className="size-4" stroke={2} />
                </Button>
              ) : (
                <Button type="button" size="lg" onClick={next}>
                  {/* On the account step the form carries "sign in"; the footer
                      button is the way past it, so it says so. */}
                  {currentStep === "account" && !signedIn
                    ? t("onboarding.skip")
                    : t("onboarding.next")}
                  <IconArrowRight className="size-4" stroke={2} />
                </Button>
              )}
            </div>
          </footer>
        </section>
      </div>

      <Dialog
        open={otpOpen}
        onOpenChange={(open) => {
          setOtpOpen(open);
          if (!open) {
            clearPendingVerify();
            setOtp("");
          }
        }}
      >
        <DialogContent className="onboarding__otp-dialog sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("onboarding.otpTitle")}</DialogTitle>
          </DialogHeader>
          <div>
            <p className="onboarding__otp-lead">
              {t("onboarding.otpLead")}{" "}
              <strong>{pendingVerifyEmail || email}</strong>.
            </p>
            <form
              className="onboarding__otp-form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitOtp();
              }}
            >
              <Label htmlFor="onboarding-otp">{t("onboarding.otpLabel")}</Label>
              <Input
                id="onboarding-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                placeholder="000000"
                aria-invalid={Boolean(authError)}
                className="h-10 text-center font-mono text-base tracking-[0.5em]"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtp(val);
                  setOtpComplete(val.length === 6);
                  clearError();
                }}
              />

              {authError && (
                <Alert variant="destructive" className="mt-2">
                  <IconAlertCircle stroke={1.75} />
                  <AlertTitle>{t("onboarding.authFailed")}</AlertTitle>
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              <Button
                className="mt-3 w-full"
                size="lg"
                disabled={!otpComplete || otp.length < 6 || authLoading}
                type="submit"
              >
                {authLoading ? <Spinner size="sm" /> : null}
                {t("onboarding.otpConfirm")}
              </Button>
            </form>
            <div className="onboarding__otp-resend">
              <span className="text-sm text-muted-foreground">
                {t("onboarding.otpNoEmail")}
              </span>
              <a
                className="text-sm text-primary underline-offset-4 hover:underline"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  const mail = pendingVerifyEmail || email.trim();
                  if (mail) void resendSignupOtp(mail);
                }}
              >
                {t("onboarding.otpResend")}
              </a>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="secondary" />}>
              {t("common.close")}
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
