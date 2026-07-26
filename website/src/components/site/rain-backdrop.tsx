import DigitalRain from "@/components/originkit/ascii-rain";
import { cn } from "@/lib/utils";

/** Glyphs the IDE actually shows: brackets, operators, hex, a little katakana. */
const CODE_GLYPHS = "01{}[]()<>/\\=+-*&|!?;:.#$@ｱｲｳｴｵｶｷｸABCDEF";

type RainBackdropProps = {
  className?: string;
  /** Tilt in degrees; a slight lean reads as motion without looking like rain. */
  angle?: number;
  glyphSize?: number;
  speed?: number;
  density?: number;
  trail?: number;
  headColor?: string;
  trailColor?: string;
  /** How the field fades out — "bottom" for headers, "edges" for full bands. */
  fade?: "bottom" | "top" | "edges" | "none";
};

const MASKS: Record<string, string | undefined> = {
  bottom: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
  top: "linear-gradient(to top, #000 0%, #000 45%, transparent 100%)",
  edges:
    "radial-gradient(ellipse 75% 70% at 50% 50%, #000 20%, transparent 78%)",
  none: undefined,
};

/**
 * Ascii Rain used as a page backdrop: muted to the basalt palette, masked so it
 * never fights the copy on top of it.
 */
export function RainBackdrop({
  className,
  angle = 12,
  glyphSize = 14,
  speed = 3.4,
  density = 26,
  trail = 14,
  headColor = "#6bc0a8",
  trailColor = "#2f6d5d",
  fade = "bottom",
}: RainBackdropProps) {
  const mask = MASKS[fade];

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      style={
        mask
          ? { maskImage: mask, WebkitMaskImage: mask }
          : undefined
      }
    >
      <DigitalRain
        angle={angle}
        glyphSize={glyphSize}
        speed={speed}
        density={density}
        trail={trail}
        headColor={headColor}
        trailColor={trailColor}
        glyphs={CODE_GLYPHS}
        shuffleGlyphs={CODE_GLYPHS}
        shuffle
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
