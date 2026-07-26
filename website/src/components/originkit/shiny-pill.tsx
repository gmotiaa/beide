import type { CSSProperties, ReactNode } from "react";

interface ShinyPillProps {
  text: string;
  link?: string;
  textColor?: string;
  shineColor?: string;
  speed?: number;
  font?: CSSProperties;
  style?: CSSProperties;
  /** Vendored addition: a marker rendered before the text (dot, icon, count). */
  leading?: ReactNode;
}

const KEYFRAMES_ID = "shiny-pill-keyframes";

/**
 * Animated Shiny Text
 *
 * A line of text with a sheen that sweeps left-to-right on a loop.
 */
export default function ShinyPill(props: ShinyPillProps) {
  props = { ...COMPONENT_DEFAULTS, ...props };
  const {
    text = "SHINY PILL",
    link,
    textColor = "#FFFFFF",
    shineColor = "#78FF83",
    speed = 1.5,
    font,
    style,
    leading,
  } = props;

  const isFixedWidth = style?.width === "100%";

  const shellStyle: CSSProperties = {
    ...style,
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box",
    ...(isFixedWidth ? {} : { minWidth: "max-content", width: "auto" }),
    whiteSpace: "nowrap",
    ...font,
  };

  const shineLayerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    color: shineColor,
    pointerEvents: "none",
    WebkitMaskImage:
      "linear-gradient(to right, transparent 30%, #000 50%, transparent 70%)",
    maskImage:
      "linear-gradient(to right, transparent 30%, #000 50%, transparent 70%)",
    WebkitMaskSize: "150% auto",
    maskSize: "150% auto",
    animation: `shinyPillSweep ${speed}s ease-in-out infinite`,
  };

  const content = (
    <div style={shellStyle}>
      <style
        id={KEYFRAMES_ID}
        dangerouslySetInnerHTML={{
          __html: `@keyframes shinyPillSweep {
                        0% { -webkit-mask-position: 200%; mask-position: 200%; }
                        100% { -webkit-mask-position: -100%; mask-position: -100%; }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        [data-shiny-pill-shine] { animation: none !important; }
                    }`,
        }}
      />
      {/* Vendored addition: a leading marker that sits outside the shine mask. */}
      {leading ? (
        <span
          style={{
            position: "relative",
            zIndex: 1,
            display: "inline-flex",
            alignItems: "center",
            marginRight: 8,
          }}
        >
          {leading}
        </span>
      ) : null}
      {/* Vendored change: the two layers share their own relative box so a
          leading marker cannot push the base copy out from under the shine. */}
      <span style={{ position: "relative", display: "inline-flex" }}>
        {/* Base layer — muted baseline color */}
        <span style={{ color: textColor }}>{text}</span>
        {/* Shine layer — bright copy masked by the sweeping gradient */}
        <span style={shineLayerStyle} data-shiny-pill-shine="" aria-hidden="true">
          {text}
        </span>
      </span>
    </div>
  );

  if (link) {
    return (
      <a href={link} style={{ textDecoration: "none", display: "inline-flex" }}>
        {content}
      </a>
    );
  }

  return content;
}

const COMPONENT_DEFAULTS = {
  text: "SHINY PILL",
  textColor: "#FFFFFF",
  shineColor: "#78FF83",
  speed: 1.5,
  font: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: "120px",
    letterSpacing: "-0.01em",
    lineHeight: "1em",
  } as CSSProperties,
};
