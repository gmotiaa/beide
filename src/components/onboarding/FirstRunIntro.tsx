import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconArrowRight,
  IconMap2,
  IconRobot,
  IconShieldCheck,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import {
  isSoundMuted,
  playConfirm,
  playIntroChime,
  setSoundMuted,
} from "../../lib/sound";

/** Actions stay inert until the whole scene has landed — see intro.css. */
const REVEAL_MS = 3700;
/** Decorative sparks thrown out when the mark lands. */
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FirstRunIntro({
  onStart,
  onSkip,
}: {
  onStart: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const reduced = useRef(prefersReducedMotion()).current;
  const [ready, setReady] = useState(reduced);
  const [muted, setMuted] = useState(isSoundMuted);
  // StrictMode remounts effects on the same instance in dev — the ref keeps
  // the chime from firing twice.
  const chimed = useRef(false);

  useEffect(() => {
    if (!chimed.current) {
      chimed.current = true;
      playIntroChime();
    }
    if (reduced) return;
    const id = window.setTimeout(() => setReady(true), REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    // Unmuting replays the chord so the choice is audible right away.
    if (!next) playIntroChime();
  };

  const start = () => {
    playConfirm();
    onStart();
  };

  const chips = [
    { icon: IconMap2, label: t("intro.chipPlan") },
    { icon: IconRobot, label: t("intro.chipAgent") },
    { icon: IconShieldCheck, label: t("intro.chipSafe") },
  ];

  return (
    <div
      className={cn("intro", reduced && "intro--still")}
      role="dialog"
      aria-modal="true"
      aria-label={t("intro.ariaLabel")}
    >
      <div className="intro__bg" aria-hidden>
        <div className="intro__orb intro__orb--a" />
        <div className="intro__orb intro__orb--b" />
        <div className="intro__orb intro__orb--c" />
        <div className="intro__grid" />
        <div className="intro__veil" />
      </div>

      <button
        type="button"
        className="intro__sound"
        onClick={toggleSound}
        aria-pressed={!muted}
        aria-label={muted ? t("intro.soundOn") : t("intro.soundOff")}
        title={muted ? t("intro.soundOn") : t("intro.soundOff")}
      >
        {muted ? (
          <IconVolumeOff className="size-4" stroke={1.75} />
        ) : (
          <IconVolume className="size-4" stroke={1.75} />
        )}
      </button>

      <div className="intro__stage">
        <div className="intro__mark-slot" aria-hidden>
          <span className="intro__halo" />
          <span className="intro__sparks">
            {SPARKS.map((deg) => (
              <i key={deg} style={{ transform: `rotate(${deg}deg)` }} />
            ))}
          </span>
          <span className="intro__ring" />
          <span className="intro__ring intro__ring--late" />
          <span className="intro__mark">
            <span className="intro__mark-glyph">b</span>
            <span className="intro__mark-sheen" />
          </span>
        </div>

        <div className="intro__wordmark" aria-hidden>
          <span className="intro__letters">
            {["b", "e", "i", "d", "e"].map((ch, i) => (
              <span
                key={`${ch}-${i}`}
                style={{ animationDelay: `${1400 + i * 110}ms` }}
              >
                {ch}
              </span>
            ))}
          </span>
          <span className="intro__shine" />
          <span className="intro__underline" />
        </div>

        <h1 className="intro__title">{t("intro.title")}</h1>
        <p className="intro__lead">{t("intro.lead")}</p>

        <div className="intro__chips">
          {chips.map((chip, i) => (
            <span
              key={chip.label}
              className="intro__chip"
              style={{ animationDelay: `${3100 + i * 140}ms` }}
            >
              <chip.icon className="size-3.5" stroke={1.75} />
              {chip.label}
            </span>
          ))}
        </div>

        <div className={cn("intro__actions", ready && "is-ready")}>
          <Button
            type="button"
            size="lg"
            autoFocus
            className="intro__cta"
            onClick={start}
          >
            {t("intro.cta")}
            <IconArrowRight className="size-4" stroke={2} />
          </Button>
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t("intro.skip")}
          </Button>
        </div>
      </div>
    </div>
  );
}
