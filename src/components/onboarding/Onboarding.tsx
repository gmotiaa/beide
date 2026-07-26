import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconFolder,
  IconMap2,
  IconRobot,
  IconShieldCheck,
  IconSparkles,
  IconTerminal2,
} from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
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
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { Spinner } from "../ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../../lib/utils";
import { useOnboardingStore } from "../../stores/onboarding";
import { useAuthStore } from "../../stores/auth";
import { useSettingsStore } from "../../stores/settings";
import type { ThemeId, LanguageId, PermissionMode } from "../../lib/types";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [signingOut, setSigningOut] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpComplete, setOtpComplete] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

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

  const submitAuth = async () => {
    if (authMode === "login") {
      const ok = await signIn(email.trim(), password);
      if (ok) complete();
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
    complete();
  };

  const submitOtp = async () => {
    const mail = pendingVerifyEmail || email.trim();
    if (!mail || otp.length < 6) return;
    const ok = await verifyEmailOtp(mail, otp);
    if (ok) {
      setOtpOpen(false);
      complete();
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
                  <CardTitle className="text-sm">pi + Grok</CardTitle>
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
                    <div className="grid grid-cols-2 gap-2">
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
                  <>
                    {!configured && (
                      <Alert className="mb-1" variant="warning">
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

                    <div className="onboarding__fields mt-1">
                      <div className="flex w-full flex-col gap-2">
                        <Label htmlFor="onboarding-email">
                          {t("onboarding.email")}
                        </Label>
                        <Input
                          id="onboarding-email"
                          name="email"
                          type="email"
                          value={email}
                          autoComplete="email"
                          placeholder="you@example.com"
                          disabled={!configured || authLoading}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="flex w-full flex-col gap-2">
                        <Label htmlFor="onboarding-password">
                          {t("onboarding.password")}
                        </Label>
                        <Input
                          id="onboarding-password"
                          name="password"
                          type="password"
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
                      </div>

                      {authError && (
                        <Alert variant="destructive">
                          <IconAlertCircle stroke={1.75} />
                          <AlertTitle>{t("onboarding.authFailed")}</AlertTitle>
                          <AlertDescription>{authError}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        type="button"
                        className="w-full"
                        size="lg"
                        disabled={
                          !configured ||
                          authLoading ||
                          !email ||
                          password.length < 6
                        }
                        onClick={() => void submitAuth()}
                      >
                        {authLoading
                          ? "…"
                          : authMode === "login"
                            ? t("onboarding.signInAndStart")
                            : t("onboarding.signUpAndStart")}
                      </Button>
                    </div>
                  </>
                )}
              </section>
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
              {currentStep === "account" && !user && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => complete()}
                >
                  {t("onboarding.skip")}
                </Button>
              )}
              {currentStep !== "account" && (
                <Button type="button" size="lg" onClick={next}>
                  {t("onboarding.next")}
                </Button>
              )}
            </div>
          </footer>
        </Card>
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
