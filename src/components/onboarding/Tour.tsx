import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

/** One-time flag — the tour plays once per install, like the intro splash. */
const TOUR_DONE_KEY = "beide.tourDone";
/** Dispatch this on `window` to replay the tour (e.g. from a palette command). */
export const TOUR_REPLAY_EVENT = "beide:tour:replay";

/** Let the shell paint (chat panel, status bar) before measuring anchors. */
const START_DELAY_MS = 900;
const SPOTLIGHT_PADDING = 8;
const CARD_WIDTH = 340;
/** Estimate used only for placement above/below the spotlight; the card
 *  itself sizes to content and stays clamped inside the viewport. */
const CARD_HEIGHT_ESTIMATE = 210;
const CARD_GAP = 12;
const VIEWPORT_MARGIN = 16;

interface TourStep {
  id: string;
  titleKey: string;
  bodyKey: string;
  /** Spotlight anchors, tried in order. All of these live in files owned by
   *  other surfaces, so they are looked up — never edited. A missing or
   *  zero-sized match falls back to a centered card. */
  selectors?: string[];
  /** Keyboard hint chips. Key names stay literal — they are not prose. */
  keys?: string[];
}

const STEPS: TourStep[] = [
  {
    id: "mentions",
    titleKey: "tour.mentionsTitle",
    bodyKey: "tour.mentionsBody",
    // BEM class on the composer wrapper; the textarea id is the documented
    // focus contract (docs/UI.md), kept as a fallback.
    selectors: [".chat-panel__composer", "#chat-composer"],
    keys: ["@"],
  },
  {
    id: "inline-edit",
    titleKey: "tour.inlineEditTitle",
    bodyKey: "tour.inlineEditBody",
    keys: ["Ctrl", "K"],
  },
  {
    id: "palette",
    titleKey: "tour.paletteTitle",
    bodyKey: "tour.paletteBody",
    keys: ["Ctrl", "Shift", "P"],
  },
  {
    id: "terminal",
    titleKey: "tour.terminalTitle",
    bodyKey: "tour.terminalBody",
    // Only matches while the terminal is open; normally centered.
    selectors: [".terminal-panel"],
    keys: ["Ctrl", "`"],
  },
  {
    id: "models",
    titleKey: "tour.modelsTitle",
    bodyKey: "tour.modelsBody",
    // The model picker sits in the composer footer; the status bar echoes the
    // active model on the right.
    selectors: [".chat-panel__composer", ".status-bar__right"],
  },
];

function isTourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    // No storage → we could not remember a dismissal; never nag every launch.
    return true;
  }
}

function markTourDone(): void {
  try {
    localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Programmatic replay hook for surfaces the tour does not own
 *  (command palette, settings): call this or dispatch TOUR_REPLAY_EVENT. */
export function replayTour(): void {
  window.dispatchEvent(new CustomEvent(TOUR_REPLAY_EVENT));
}

interface Anchor {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureAnchor(step: TourStep): Anchor | null {
  for (const selector of step.selectors ?? []) {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    // Hidden or collapsed targets (closed panels) give useless spotlights.
    if (rect.width < 2 || rect.height < 2) continue;
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

/**
 * One-time feature tour over the IDE shell. Mounted inside AppLayout, so it
 * can only appear after FirstRunIntro / Onboarding are done (App.tsx renders
 * either those or the layout, never both).
 */
export function Tour() {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const step = STEPS[index] ?? STEPS[0]!;
  const isLast = index === STEPS.length - 1;

  const finish = useCallback(() => {
    markTourDone();
    setActive(false);
  }, []);

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) {
      finish();
      return;
    }
    setIndex(index + 1);
  }, [index, finish]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Auto-start once per install, slightly delayed so anchors exist.
  useEffect(() => {
    if (isTourDone()) return;
    const id = window.setTimeout(() => {
      setIndex(0);
      setActive(true);
    }, START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Replay on demand — the listener always lives so any surface can fire it.
  useEffect(() => {
    const onReplay = () => {
      setIndex(0);
      setActive(true);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, onReplay);
  }, []);

  // Measure the current step's anchor; re-measure on resize. Layout effect so
  // a step change never paints one frame with the previous step's spotlight.
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => setAnchor(measureAnchor(step));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, step]);

  // Esc skips; arrows navigate. Registered on window like FirstRunIntro so it
  // works regardless of focus.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, finish, next, back]);

  if (!active) return null;

  const spot = anchor
    ? {
        top: anchor.top - SPOTLIGHT_PADDING,
        left: anchor.left - SPOTLIGHT_PADDING,
        width: anchor.width + SPOTLIGHT_PADDING * 2,
        height: anchor.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Card near the spotlight: below if it fits, otherwise above; horizontally
  // centered on the target and clamped into the viewport.
  let cardStyle: CSSProperties | undefined;
  if (spot) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fitsBelow =
      spot.top + spot.height + CARD_GAP + CARD_HEIGHT_ESTIMATE <=
      vh - VIEWPORT_MARGIN;
    const top = fitsBelow
      ? spot.top + spot.height + CARD_GAP
      : clamp(
          spot.top - CARD_GAP - CARD_HEIGHT_ESTIMATE,
          VIEWPORT_MARGIN,
          vh - VIEWPORT_MARGIN - CARD_HEIGHT_ESTIMATE,
        );
    const left = clamp(
      spot.left + spot.width / 2 - CARD_WIDTH / 2,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, vw - CARD_WIDTH - VIEWPORT_MARGIN),
    );
    cardStyle = { position: "fixed", top, left, width: CARD_WIDTH };
  }

  return (
    <div
      className="fixed inset-0 z-[240]"
      role="dialog"
      aria-modal="true"
      aria-label={t("tour.ariaLabel")}
    >
      {spot ? (
        // The spotlight hole: an outline box whose oversized shadow dims
        // everything around the target — no SVG mask needed.
        <div
          aria-hidden
          className="fixed rounded-lg ring-2 ring-primary/60 transition-all duration-200"
          style={{
            top: spot.top,
            left: spot.left,
            width: spot.width,
            height: spot.height,
            boxShadow: "0 0 0 200vmax rgb(0 0 0 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/55" />
      )}

      <div
        className={cn(
          !spot && "fixed inset-0 flex items-center justify-center",
        )}
      >
        <div
          className="flex flex-col gap-3 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
          style={cardStyle ?? { width: CARD_WIDTH, maxWidth: "calc(100vw - 32px)" }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{t(step.titleKey)}</h2>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("tour.stepCounter", {
                current: index + 1,
                total: STEPS.length,
              })}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(step.bodyKey)}
          </p>

          {step.keys && (
            <div className="flex items-center gap-1" aria-hidden>
              {step.keys.map((key, i) => (
                <span key={key} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-xs text-muted-foreground">+</span>
                  )}
                  <Kbd>{key}</Kbd>
                </span>
              ))}
            </div>
          )}

          <div className="mt-1 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={finish}>
              {t("tour.skip")}
            </Button>
            <div className="flex items-center gap-2">
              {index > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={back}>
                  {t("tour.back")}
                </Button>
              )}
              <Button type="button" size="sm" autoFocus onClick={next}>
                {isLast ? t("tour.done") : t("tour.next")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
