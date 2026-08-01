import * as React from "react";

import MagneticButton from "@/components/originkit/magnetic-button";

const FONT: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 15,
  lineHeight: "1em",
  letterSpacing: "-0.01em",
};

type MagneticCtaProps = {
  label: string;
  to: string;
  icon?: React.ReactNode;
  /** "solid" is the page's single primary action; "ghost" sits next to it. */
  variant?: "solid" | "ghost";
};

/**
 * Origin Kit's magnetic button rendered as a normal link. Page navigation is
 * deliberately browser-native; this static site does not need a router runtime.
 */
export function MagneticCta({
  label,
  to,
  icon,
  variant = "solid",
}: MagneticCtaProps) {
  const external = /^https?:/.test(to);

  const solid = variant === "solid";

  return (
    <MagneticButton
      label={label}
      icon={icon}
      link={to}
      newTab={external}
      font={FONT}
      fill={solid ? "#4fa88f" : "transparent"}
      textColor={solid ? "#0f1211" : "#e9e7e2"}
      sweepColor={solid ? "#6bc0a8" : "#24282a"}
      sweepTextColor={solid ? "#0f1211" : "#e9e7e2"}
      paddingX={28}
      paddingY={16}
      radius={10}
      magnet={7}
      border={!solid}
      borderOptions={{ color: "#2b2f31", width: 1 }}
      style={{
        boxShadow: solid
          ? "0 10px 30px rgba(79, 168, 143, 0.18)"
          : "none",
      }}
    />
  );
}
