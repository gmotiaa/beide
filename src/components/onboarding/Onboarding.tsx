import { useEffect, useState } from "react";
import {
  Alert,
  Avatar as HeroAvatar,
  Button as HeroButton,
  Form,
  Input as HeroInput,
  InputOTP,
  Label as HeroLabel,
  Link,
  Modal,
  REGEXP_ONLY_DIGITS,
  Spinner,
  TextField,
} from "@heroui/react";
import {
  IconFolder,
  IconMap2,
  IconRobot,
  IconShieldCheck,
  IconSparkles,
  IconTerminal2,
} from "@tabler/icons-react";
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
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../../lib/utils";
import { useOnboardingStore } from "../../stores/onboarding";
import { useAuthStore } from "../../stores/auth";
import { useSettingsStore } from "../../stores/settings";
import type { ThemeId, LanguageId, PermissionMode } from "../../lib/types";

const STEPS = ["welcome", "features", "settings", "account"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  welcome: "Старт",
  features: "Режимы",
  settings: "Настройки",
  account: "Аккаунт",
};

const FEATURES = [
  {
    icon: IconMap2,
    title: "План",
    body: "Читает репозиторий, пишет план. Файлы не трогает.",
    chip: "readonly",
  },
  {
    icon: IconRobot,
    title: "Агент",
    body: "Edit / write / bash. Опасные действия — только после твоего ok.",
    chip: "tools",
  },
  {
    icon: IconFolder,
    title: "Контекст",
    body: "@файл, картинки, дерево workspace — агент видит проект.",
    chip: "context",
  },
] as const;

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
      aria-label="Онбординг beide"
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
              IDE, где агент
              <br />
              <span>рядом с кодом</span>
            </h2>
            <p className="onboarding__sub">
              Monaco · Plan / Agent · diff перед записью · checkpoints. Grok
              через локальный ~/.pi/agent.
            </p>
          </div>

          <div className="onboarding__aside-stats">
            <Card size="sm" className="onboarding__stat-card">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="onboarding__stat-icon">
                  <IconTerminal2 className="size-4" stroke={1.75} />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm">pi + Grok</CardTitle>
                  <CardDescription>агент в main process</CardDescription>
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
                  <CardDescription>права перед записью</CardDescription>
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
                      {STEP_LABELS[s]}
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
                  Шаг 1 · Welcome
                </Badge>
                <h1>Добро пожаловать в beide</h1>
                <p className="onboarding__lead">
                  Открой папку, пиши в Monaco, справа — агент. Plan только
                  исследует, Agent может править файлы под твоим контролем.
                </p>

                <div className="onboarding__hero-cards">
                  <Card size="sm" className="onboarding__hero-card">
                    <CardHeader className="gap-1">
                      <CardTitle>Windows-first</CardTitle>
                      <CardDescription>
                        Electron + Monaco + xterm — desktop shell без
                        браузерных костылей.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                  <Card size="sm" className="onboarding__hero-card">
                    <CardHeader className="gap-1">
                      <CardTitle>Без marketplace</CardTitle>
                      <CardDescription>
                        Фокус на агенте и коде, не на магазине расширений.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              </section>
            )}

            {currentStep === "features" && (
              <section className="onboarding__section">
                <Badge variant="secondary" className="w-fit font-normal">
                  Шаг 2 · Режимы
                </Badge>
                <h1>Как работает агент</h1>
                <p className="onboarding__lead">
                  Два режима — исследование и исполнение. Переключатель в шапке
                  чата.
                </p>

                <div className="onboarding__feature-grid">
                  {FEATURES.map((f) => (
                    <Card key={f.title} size="sm" className="onboarding__feature-card">
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
                  Шаг 3 · Настройки
                </Badge>
                <h1>Быстрый старт</h1>
                <p className="onboarding__lead">
                  Можно сразу настроить тему, язык и права. Потом — в Settings.
                </p>

                <div className="onboarding__fields">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Тема</div>
                    <p className="text-xs text-muted-foreground">
                      Меняется сразу, пока ты в онбординге
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["light", "Светлая"],
                          ["dark", "Тёмная"],
                          ["midnight", "Midnight"],
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
                    <div className="text-sm font-medium">Язык интерфейса</div>
                    <div className="grid grid-cols-2 gap-2">
                      <ChoicePill
                        active={settings.language === "ru"}
                        onClick={() =>
                          void updateSettings({ language: "ru" as LanguageId })
                        }
                      >
                        Русский
                      </ChoicePill>
                      <ChoicePill
                        active={settings.language === "en"}
                        onClick={() =>
                          void updateSettings({ language: "en" as LanguageId })
                        }
                      >
                        English
                      </ChoicePill>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium">Права агента</div>
                    <p className="text-xs text-muted-foreground">
                      Рекомендуем ask для новых проектов
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
                          Спрашивать перед правками
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Diff → Apply / Reject
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
                          Применять сразу
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Power-user, для доверенных репо
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
                  Шаг 4 · Аккаунт
                </Badge>
                <h1>Аккаунт (опционально)</h1>
                <p className="onboarding__lead">
                  Можно пропустить — агент и workspace работают локально. Вход
                  нужен только если пользуешься облачным аккаунтом beide.
                </p>

                {!authReady ? (
                  <div className="onboarding__center">
                    <Spinner size="md" />
                  </div>
                ) : user && session ? (
                  <Card size="sm">
                    <CardHeader className="flex-row items-center gap-3">
                      <HeroAvatar>
                        <HeroAvatar.Fallback>
                          {(user.email?.[0] ?? "u").toUpperCase()}
                        </HeroAvatar.Fallback>
                      </HeroAvatar>
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {user.email}
                        </CardTitle>
                        <CardDescription>
                          Сессия восстановлена. Можно продолжить или сменить
                          аккаунт.
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => complete()}>
                        Продолжить
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={signingOut}
                        onClick={() => void handleSignOut()}
                      >
                        {signingOut ? "…" : "Выйти и войти другим"}
                      </Button>
                    </CardFooter>
                  </Card>
                ) : (
                  <>
                    {!configured && (
                      <Alert className="mb-1" status="warning">
                        <Alert.Indicator />
                        <Alert.Content>
                          <Alert.Title>Supabase не настроен</Alert.Title>
                          <Alert.Description>
                            Пропусти шаг — IDE работает полностью офлайн.
                          </Alert.Description>
                        </Alert.Content>
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
                        <TabsTrigger value="login">Вход</TabsTrigger>
                        <TabsTrigger value="register">Регистрация</TabsTrigger>
                      </TabsList>
                    </Tabs>

                    <div className="onboarding__fields mt-1">
                      <TextField
                        fullWidth
                        isDisabled={!configured || authLoading}
                        name="email"
                        type="email"
                        value={email}
                        variant="secondary"
                        onChange={setEmail}
                      >
                        <HeroLabel>Email</HeroLabel>
                        <HeroInput
                          autoComplete="email"
                          placeholder="you@example.com"
                        />
                      </TextField>

                      <TextField
                        fullWidth
                        isDisabled={!configured || authLoading}
                        name="password"
                        type="password"
                        value={password}
                        variant="secondary"
                        onChange={setPassword}
                      >
                        <HeroLabel>Пароль</HeroLabel>
                        <HeroInput
                          autoComplete={
                            authMode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          placeholder="минимум 6 символов"
                        />
                      </TextField>

                      {authError && (
                        <Alert status="danger">
                          <Alert.Indicator />
                          <Alert.Content>
                            <Alert.Title>Не вышло</Alert.Title>
                            <Alert.Description>{authError}</Alert.Description>
                          </Alert.Content>
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
                            ? "Войти и начать"
                            : "Создать и начать"}
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
                Назад
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => complete()}>
                Пропустить всё
              </Button>
            )}

            <div className="onboarding__footer-right">
              {currentStep === "account" && !user && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => complete()}
                >
                  Пропустить
                </Button>
              )}
              {currentStep !== "account" && (
                <Button type="button" size="lg" onClick={next}>
                  Далее
                </Button>
              )}
            </div>
          </footer>
        </Card>
      </div>

      <Modal.Backdrop
        isOpen={otpOpen}
        variant="blur"
        onOpenChange={(open) => {
          setOtpOpen(open);
          if (!open) {
            clearPendingVerify();
            setOtp("");
          }
        }}
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="onboarding__otp-dialog">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Подтверждение email</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p className="onboarding__otp-lead">
                Мы отправили 6-значный код на{" "}
                <strong>{pendingVerifyEmail || email}</strong>.
              </p>
              <Form
                className="onboarding__otp-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitOtp();
                }}
              >
                <HeroLabel>Код из письма</HeroLabel>
                <InputOTP
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otp}
                  variant="secondary"
                  isInvalid={Boolean(authError)}
                  onComplete={(code) => {
                    setOtp(code);
                    setOtpComplete(true);
                  }}
                  onChange={(val) => {
                    setOtp(val);
                    setOtpComplete(val.length === 6);
                    clearError();
                  }}
                >
                  <InputOTP.Group>
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                  </InputOTP.Group>
                  <InputOTP.Separator />
                  <InputOTP.Group>
                    <InputOTP.Slot index={3} />
                    <InputOTP.Slot index={4} />
                    <InputOTP.Slot index={5} />
                  </InputOTP.Group>
                </InputOTP>

                {authError && (
                  <Alert status="danger" className="mt-2">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Не вышло</Alert.Title>
                      <Alert.Description>{authError}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                <HeroButton
                  className="mt-3 w-full"
                  isDisabled={!otpComplete || otp.length < 6}
                  isPending={authLoading}
                  type="submit"
                >
                  {({ isPending }) => (
                    <>
                      {isPending ? <Spinner color="current" size="sm" /> : null}
                      Подтвердить
                    </>
                  )}
                </HeroButton>
              </Form>
              <div className="onboarding__otp-resend">
                <span className="text-sm text-muted">Не пришло письмо?</span>
                <Link
                  className="text-sm"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    const mail = pendingVerifyEmail || email.trim();
                    if (mail) void resendSignupOtp(mail);
                  }}
                >
                  Отправить снова
                </Link>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <HeroButton slot="close" variant="secondary">
                Закрыть
              </HeroButton>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
