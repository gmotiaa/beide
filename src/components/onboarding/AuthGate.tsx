import { useTranslation } from "react-i18next";
import { IconSparkles } from "@tabler/icons-react";
import { Badge } from "../ui/badge";
import { Card, CardHeader } from "../ui/card";
import { Spinner } from "../ui/spinner";
import { AccountForm } from "./AccountForm";
import { useAuthStore } from "../../stores/auth";

/**
 * Full-screen mandatory sign-in. Rendered instead of the IDE shell whenever
 * there is no Supabase session — the account is required: usage limits and the
 * model provider key are both served per-account from Supabase.
 */
export function AuthGate() {
  const { t } = useTranslation();
  const authReady = useAuthStore((s) => s.ready);

  return (
    <div
      className="onboarding"
      role="dialog"
      aria-modal="true"
      aria-label={t("authGate.ariaLabel")}
    >
      <div className="onboarding__bg" aria-hidden>
        <div className="onboarding__orb onboarding__orb--a" />
        <div className="onboarding__orb onboarding__orb--b" />
        <div className="onboarding__grid" />
      </div>

      <div className="onboarding__frame onboarding__frame--narrow">
        <Card className="onboarding__panel border-0 shadow-lg ring-1 ring-foreground/10">
          <CardHeader className="gap-3 border-b border-border pb-4">
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
          </CardHeader>

          <div className="onboarding__body">
            <section className="onboarding__section">
              <h1>{t("authGate.title")}</h1>
              <p className="onboarding__lead">{t("authGate.lead")}</p>
              {!authReady ? (
                <div className="onboarding__center">
                  <Spinner size="lg" />
                </div>
              ) : (
                <AccountForm onAuthenticated={() => undefined} />
              )}
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
}
