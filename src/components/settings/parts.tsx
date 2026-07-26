import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

/**
 * Shared building blocks for the settings screen. Every section is a `<Panel>`
 * so headings, spacing and the icon chip stay identical across sections.
 */
export function Panel({
  icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={cn("settings-panel", className)}>
      <CardHeader className="settings-panel__head">
        {icon ? (
          <div className="settings-panel__icon" aria-hidden>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-0.5">{description}</CardDescription>
          ) : null}
        </div>
        {action ? <div className="settings-panel__action">{action}</div> : null}
      </CardHeader>
      <CardContent className="settings-panel__body">{children}</CardContent>
    </Card>
  );
}

/** Label + hint on the left, control on the right — the default settings row. */
export function Row({
  label,
  hint,
  control,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  control: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <label className="settings-row__label" htmlFor={htmlFor}>
          {label}
        </label>
        {hint ? <p className="settings-row__hint">{hint}</p> : null}
      </div>
      <div className="settings-row__control">{control}</div>
    </div>
  );
}

/** Stacked label + full-width control, for choice grids and inputs. */
export function Field({
  label,
  hint,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="settings-field">
      <div className="settings-field__label">{label}</div>
      {hint ? <p className="settings-field__hint">{hint}</p> : null}
      {children}
    </div>
  );
}

export interface Choice {
  value: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
}

export function ChoiceGroup({
  options,
  value,
  onChange,
  disabled,
  columns,
}: {
  options: Choice[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Minimum column width in px; the grid still auto-fits. */
  columns?: number;
}) {
  return (
    <div
      className="settings-choice-grid"
      style={
        columns
          ? ({ "--settings-choice-min": `${columns}px` } as React.CSSProperties)
          : undefined
      }
      role="radiogroup"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "settings-choice",
              active && "settings-choice--active",
              disabled && "settings-choice--disabled",
            )}
          >
            <span className="settings-choice__label">
              {opt.icon}
              {opt.label}
            </span>
            {opt.hint ? (
              <span className="settings-choice__hint">{opt.hint}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Ticking clock for the quota countdowns. One interval per consumer is fine —
 * the settings screen mounts a handful of them and unmounts with the view.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
