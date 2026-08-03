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
import type { UsageHistoryDay } from "../../lib/supabase-billing";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Separator } from "../ui/separator";
import { formatTokens } from "./helpers";
import { ChoiceGroup, Field, Panel, useNow } from "./parts";

/** Range shown by the history mini-chart — also the `p_days` sent to the RPC. */
const HISTORY_DAYS = 30;
/** Non-zero bars never shrink below this so a single-token day stays visible. */
const MIN_BAR_PCT = 8;

function localeOf(lang?: string): string {
  return lang?.startsWith("ru") ? "ru-RU" : "en-US";
}

/** `YYYY-MM-DD` in UTC — matches the `date::text` cast `get_usage_history` returns. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * `get_usage_history` only emits days that had a `spend` event, so a quiet
 * day is simply absent from the row set. Fill the gaps back in — the chart
 * needs one bar per calendar day, zero-token days included.
 */
function padHistory(rows: UsageHistoryDay[], days: number): UsageHistoryDay[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const today = new Date();
  const out: UsageHistoryDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = isoDate(d);
    out.push(byDay.get(key) ?? { day: key, tokens: 0, creditsUsed: 0, calls: 0 });
  }
  return out;
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

/** Last-N-days token spend, as a mini bar chart. Only the cloud keeps this ledger. */
function HistoryStrip({ data: rows }: { data: UsageHistoryDay[] }) {
  const { t, i18n } = useTranslation();

  const data = useMemo(() => padHistory(rows, HISTORY_DAYS), [rows]);
  const peakTokens = useMemo(() => Math.max(0, ...data.map((d) => d.tokens)), [data]);
  const chartPeak = Math.max(1, peakTokens);
  const total = useMemo(() => data.reduce((sum, d) => sum + d.tokens, 0), [data]);

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
        <span>
          {t("settings.usageRangeTotal", {
            tokens: `${formatTokens(total)} tok`,
            days: data.length,
          })}
        </span>
        <span className="tabular-nums">
          {t("settings.usageMaxDay", { tokens: `${formatTokens(peakTokens)} tok` })}
        </span>
      </div>
      <div className="usage-history__bars">
        {data.map((d, i) => {
          const isZero = d.tokens <= 0;
          const isToday = i === data.length - 1;
          const pct = Math.min(100, Math.max(MIN_BAR_PCT, (d.tokens / chartPeak) * 100));
          return (
            <div
              key={d.day}
              className={cn("usage-history__bar", isToday && "usage-history__bar--today")}
              aria-label={`${fmtDay(d.day)}: ${formatTokens(d.tokens)} tok`}
            >
              <span
                className={cn("usage-history__fill", isZero && "usage-history__fill--zero")}
                style={isZero ? undefined : { height: `${pct}%` }}
              />
              <div className="usage-history__tooltip" role="tooltip">
                <div className="usage-history__tooltip-date">{fmtDay(d.day)}</div>
                <div className="usage-history__tooltip-meta tabular-nums">
                  {formatTokens(d.tokens)} tok · {t("settings.usageDayCalls", { count: d.calls })}
                </div>
              </div>
            </div>
          );
        })}
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
    void loadHistory(HISTORY_DAYS);
  }, [loadHistory, source]);

  // The DB row is the authority; PLANS is only the offline mirror.
  const limits = useMemo(() => effectiveLimits(data), [data]);
  const gate = useMemo(() => canSpend(data, 48), [data]);

  // Self-service plan/credits only exist where the server allows it (the
  // demo_billing flag) — counters are Supabase-only now.
  const canSelfServe = data.demo === true;

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
          <Badge variant="default" className="h-6 px-2 font-normal">
            Supabase
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || historyLoading}
            onClick={() => {
              void load();
              void loadHistory(HISTORY_DAYS);
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
            // The hosted plan_limits row can drift from the offline PLANS
            // mirror (it did: 50k/300k live vs 20k/80k mirrored). For the
            // account's own plan show the server truth; the mirror only
            // describes plans the server told us nothing about.
            hint: t("settings.planQuota", {
              h5: formatTokens(id === data.plan ? limits.tokens5h : PLANS[id].tokens5h),
              week: formatTokens(id === data.plan ? limits.tokensWeek : PLANS[id].tokensWeek),
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
