import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconAlertCircle } from "@tabler/icons-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
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
import { useAuthStore } from "../../stores/auth";

/**
 * Sign-in / sign-up form with the email-OTP dialog. Shared between the
 * onboarding account step and the startup AuthGate — the account is mandatory,
 * so the same flow has to work in both places.
 */
export function AccountForm({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { t } = useTranslation();

  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const resendSignupOtp = useAuthStore((s) => s.resendSignupOtp);
  const pendingVerifyEmail = useAuthStore((s) => s.pendingVerifyEmail);
  const clearPendingVerify = useAuthStore((s) => s.clearPendingVerify);
  const authError = useAuthStore((s) => s.error);
  const authLoading = useAuthStore((s) => s.loading);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [otp, setOtp] = useState("");
  const [otpComplete, setOtpComplete] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  useEffect(() => {
    clearError();
  }, [authMode, clearError]);

  useEffect(() => {
    if (pendingVerifyEmail) {
      setOtpOpen(true);
      setEmail(pendingVerifyEmail);
    }
  }, [pendingVerifyEmail]);

  const submitAuth = async () => {
    if (authMode === "login") {
      const ok = await signIn(email.trim(), password);
      if (ok) onAuthenticated();
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
    onAuthenticated();
  };

  const submitOtp = async () => {
    const mail = pendingVerifyEmail || email.trim();
    if (!mail || otp.length < 6) return;
    const ok = await verifyEmailOtp(mail, otp);
    if (ok) {
      setOtpOpen(false);
      onAuthenticated();
    }
  };

  return (
    <>
      <Tabs
        value={authMode}
        onValueChange={(v) => setAuthMode(String(v) as "login" | "register")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t("onboarding.signIn")}</TabsTrigger>
          <TabsTrigger value="register">{t("onboarding.signUp")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="onboarding__fields mt-1">
        <div className="flex w-full flex-col gap-2">
          <Label htmlFor="account-email">{t("onboarding.email")}</Label>
          <Input
            id="account-email"
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            placeholder="you@example.com"
            disabled={authLoading}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex w-full flex-col gap-2">
          <Label htmlFor="account-password">{t("onboarding.password")}</Label>
          <Input
            id="account-password"
            name="password"
            type="password"
            value={password}
            autoComplete={
              authMode === "login" ? "current-password" : "new-password"
            }
            placeholder={t("onboarding.passwordPlaceholder")}
            disabled={authLoading}
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
            authLoading ||
            !email ||
            // supabase/config.toml: minimum_password_length = 8.
            // Gating at 6 let a password through the UI only to
            // fail server-side with a raw English GoTrue error.
            password.length < 8
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
              <Label htmlFor="account-otp">{t("onboarding.otpLabel")}</Label>
              <Input
                id="account-otp"
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
    </>
  );
}
