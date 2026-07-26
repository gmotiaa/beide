import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconAlertTriangle,
  IconCoins,
  IconGauge,
  IconRefresh,
  IconRotateClockwise,
  IconSparkles,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";
import {
  PLANS,
  canSpend,
  durationParts,
  effectiveLimits,
  formatResetAt,
  msUntil,
  remainingPct,
  type UsagePlanId,
} from "../../lib/usage";
import { useAuthStore } from "../../stores/auth";
import { useUsageStore } from "../../stores/usage";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { formatTokens } from "./helpers";
import { ChoiceGroup, Field, Panel, useNow } from "./parts";

function localeOf(lang?: string): string {
  return lang?.startsWith("ru") ? "ru-RU" : "en-US";
}

/** One quota window: % left, absolute usage, bar, reset moment. */
function Meter({
  title,
  used,
  limit,
  endsAt,
  now,
}: {
  title: string;
  used: number;
  limit: number;
  endsAt: number;
  now: number;
}) {
  const { t, i18n } = useTranslation();
  const remaining = remainingPct(used, limit);
  const empty = remaining <= 0.05;
  const low = remaining > 0 && remaining < 25;
  const left = msUntil(endsAt, now);
  const { hours, minutes } = durationParts(left);
  const inLabel =
    left <= 0
      ? t("settings.resetInSoon")
      : hours > 0
        ? t("settings.resetInHm", { h: hours, m: minutes })
        : t("settings.resetInM", { m: minutes });

  return (
    <div className={cn("usage-meter", empty && "is-empty", low && "is-low")}>
      <div className="usage-meter__title">{title}</div>
      <div className="usage-meter__value tabular-nums">
        {Math.round(remaining)}
        <span className="usage-meter__unit">%</span>
        <span className="usage-meter__caption">{t("settings.remaining")}</span>
      </div>
      <Progress value={remaining} className="usage-meter__bar w-full" />
      <div className="usage-meter__foot tabular-nums">
        <span>
          {formatTokens(used)} / {formatTokens(limit)} tok
        </span>
        <span title={formatResetAt(endsAt, localeOf(i18n.language))}>
          {t("settings.resetIn", { time: inLabel })}
        </span>
      </div>
    </div>
  );
}

/** Last-N-days token spend. Only the cloud keeps this ledger. */
function HistoryStrip({ data }: { data: { day: string; tokens: number }[] }) {
  const { t, i18n } = useTranslation();
  const peak = Math.max(1, ...data.map((d) => d.tokens));
  const total = data.reduce((sum, d) => sum + d.tokens, 0);
  const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(localeOf(i18n.language), {
          day: "numeric",
          month: "short",
        });
  };

  return (
    <div className="usage-history">
      <div className="usage-history__head">
        <span>{t("settings.history")}</span>
        <span className="tabular-nums">{formatTokens(total)} tok</span>
      </div>
      <div className="usage-history__bars">
        {data.map((d) => (
          <div
            key={d.day}
            className="usage-history__bar"
            title={`${fmtDay(d.day)} · ${formatTokens(d.tokens)} tok`}
          >
            <span
              className="usage-history__fill"
              style={{ height: `${Math.max(3, (d.tokens / peak) * 100)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UsageSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const data = useUsageStore((s) => s.data);
  const source = useUsageStore((s) => s.source);
  const accountEmail = useUsageStore((s) => s.accountEmail);
  const error = useUsageStore((s) => s.error);
  const busy = useUsageStore((s) => s.busy);
  const history = useUsageStore((s) => s.history);
  const historyLoading = useUsageStore((s) => s.historyLoading);
  const load = useUsageStore((s) => s.load);
  const loadHistory = useUsageStore((s) => s.loadHistory);
  const clearError = useUsageStore((s) => s.clearError);
  const setPlan = useUsageStore((s) => s.setPlan);
  const addCredits = useUsageStore((s) => s.addCredits);
  const resetToday = useUsageStore((s) => s.resetToday);

  const now = useNow(30_000);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, source]);

  // The DB row is the authority; PLANS is only the offline mirror.
  const limits = useMemo(() => effectiveLimits(data), [data]);
  const gate = useMemo(() => canSpend(data, 48), [data]);

  // Self-service plan/credits only exist where the server allows it (demo
  // projects) or where the counters are local anyway.
  const canSelfServe = source !== "supabase" || data.demo === true;

  const gateEndsAt = gate.endsAt ?? data.h5.endsAt;
  const gateLeft = durationParts(msUntil(gateEndsAt, now));
  const gateIn =
    gateLeft.hours > 0
      ? t("settings.resetInHm", { h: gateLeft.hours, m: gateLeft.minutes })
      : t("settings.resetInM", { m: gateLeft.minutes });

  return (
    <Panel
      className="settings-panel--usage"
      icon={<IconGauge className="size-4" />}
      title={t("settings.usagePanel")}
      description={t("settings.usageHint")}
      action={
        <div className="flex items-center gap-2">
          <Badge
            variant={source === "supabase" ? "default" : "outline"}
            className="h-6 px-2 font-normal"
          >
            {source === "supabase" ? "Supabase" : t("settings.localAccount")}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || historyLoading}
            onClick={() => {
              void load();
              void loadHistory();
            }}
            aria-label={t("settings.refresh")}
          >
            <IconRefresh
              className={cn("size-4", (busy || historyLoading) && "animate-spin")}
            />
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="usage-banner usage-banner--error">
          <IconAlertTriangle className="size-4 shrink-0" />
          <p className="min-w-0 flex-1">{error}</p>
          <button
            type="button"
            className="usage-banner__close"
            onClick={clearError}
            aria-label={t("settings.dismiss")}
          >
            <IconX className="size-3.5" />
          </button>
        </div>
      ) : null}

      {!gate.ok ? (
        <div className="usage-banner usage-banner--error">
          <IconAlertTriangle className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{t("settings.limitReached")}</div>
            <p className="usage-banner__hint">
              {t("settings.limitReachedHint")}{" "}
              {t("settings.resetIn", { time: gateIn })}
            </p>
          </div>
        </div>
      ) : null}

      {source !== "supabase" ? (
        <div className="usage-banner usage-banner--info">
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {t("settings.cloudBillingHintTitle")}
            </div>
            <p className="usage-banner__hint">
              {t("settings.cloudBillingHintBody")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="usage-account">
        <IconUserCircle className="size-8 shrink-0 text-muted-foreground" stroke={1.5} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {accountEmail ?? user?.email ?? t("settings.localAccount")}
          </div>
          <p className="text-xs text-muted-foreground">
            {source === "supabase"
              ? t("settings.signedInCloud")
              : user
                ? t("settings.signedIn")
                : t("settings.localAccountHint")}
          </p>
        </div>
        <Badge
          variant={data.plan === "pro" ? "default" : "outline"}
          className="h-6 shrink-0 px-2.5 font-semibold tracking-wide uppercase"
        >
          {limits.label || PLANS[data.plan].label}
        </Badge>
      </div>

      <Field label={t("settings.balance")}>
        <div className="usage-meter-grid">
          <Meter
            title={t("settings.limit5h")}
            used={data.h5.used}
            limit={limits.tokens5h}
            endsAt={data.h5.endsAt}
            now={now}
          />
          <Meter
            title={t("settings.limitWeek")}
            used={data.week.used}
            limit={limits.tokensWeek}
            endsAt={data.week.endsAt}
            now={now}
          />
          <div className="usage-meter usage-meter--credits">
            <div className="usage-meter__title">{t("settings.creditsLeft")}</div>
            <div className="usage-meter__value tabular-nums">
              {formatTokens(data.credits)}
              <span className="usage-meter__unit">tok</span>
            </div>
            <p className="usage-meter__note">{t("settings.creditsHint")}</p>
          </div>
        </div>
      </Field>

      {source === "supabase" && history.length > 0 ? (
        <HistoryStrip data={history} />
      ) : null}

      <Separator />

      <Field
        label={t("settings.plan")}
        hint={canSelfServe ? undefined : t("settings.planLockedHint")}
      >
        <ChoiceGroup
          columns={200}
          value={data.plan}
          disabled={!canSelfServe || busy}
          onChange={(v) => void setPlan(v as UsagePlanId)}
          options={(Object.keys(PLANS) as UsagePlanId[]).map((id) => ({
            value: id,
            label: PLANS[id].label,
            icon:
              id === "pro" ? (
                <IconSparkles className="size-3.5 text-primary" />
              ) : undefined,
            hint: t("settings.planQuota", {
              h5: formatTokens(PLANS[id].tokens5h),
              week: formatTokens(PLANS[id].tokensWeek),
            }),
          }))}
        />
      </Field>

      {canSelfServe ? (
        <>
          <Separator />
          <Field label={t("settings.demoTools")} hint={t("settings.demoToolsHint")}>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void addCredits()}
              >
                <IconCoins className="size-4" />
                {t("settings.addCredits")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void resetToday()}
              >
                <IconRotateClockwise className="size-4" />
                {t("settings.resetUsage")}
              </Button>
            </div>
          </Field>
        </>
      ) : null}
    </Panel>
  );
}
