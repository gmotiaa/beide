import GlitchCharReveal from "@/components/originkit/scramble-text";
import { cn } from "@/lib/utils";

/**
 * The vendored Origin Kit text component fills its parent (100% / overflow
 * hidden) and takes typography through a `font` object, so every usage needs a
 * sized wrapper. This is that wrapper, pinned to the site's type scale.
 */
export function ScrambleHeadline({
  text,
  className,
  height = 88,
  fontSize = 56,
  lineHeight = "1.05em",
  weight = 600,
  color = "#e9e7e2",
  align = "left",
  mono = false,
  letterSpacing = "-0.01em",
}: {
  text: string;
  className?: string;
  height?: number | string;
  fontSize?: number;
  lineHeight?: string;
  weight?: number;
  color?: string;
  align?: "left" | "center";
  mono?: boolean;
  letterSpacing?: string;
}) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      aria-label={text}
    >
      <GlitchCharReveal
        words={text}
        color={color}
        tag="p"
        font={{
          fontFamily: mono
            ? '"JetBrains Mono", ui-monospace, monospace'
            : '"DM Sans", ui-sans-serif, system-ui, sans-serif',
          fontWeight: weight,
          fontSize,
          lineHeight,
          letterSpacing,
          textAlign: align,
        }}
        enterAnimation={{
          mode: "oneLine",
          restState: "solid",
          replay: false,
          position: "above",
          scrambleIntensity: 70,
          ease: { type: "tween", duration: 1, ease: "easeOut" },
          flickerEnabled: true,
          flickerColor: "#4fa88f",
          flickerIntensity: 70,
          flickerSpeed: 12,
        }}
        hoverAnimation={{
          type: "diffusion",
          lines: "oneLine",
          radius: 2,
          collapse: false,
          glitchChars: "abcdefghijklmnopqrstuvwxyz01{}<>/",
          glitchShuffle: true,
        }}
      />
    </div>
  );
}
