import * as React from "react";

import ShinyPill from "@/components/originkit/shiny-pill";
import { cn } from "@/lib/utils";

type ShinyBadgeProps = {
  children: string;
  className?: string;
  /** A live dot in front of the text — used for the "current build" pill. */
  dot?: boolean;
};

/**
 * Origin Kit's Shiny Pill in a bordered chip, sized for section labels.
 */
export function ShinyBadge({ children, className, dot }: ShinyBadgeProps) {
  return (
    <span
      className={cn(
        "border-border/80 bg-panel/70 inline-flex items-center rounded-full border px-3 py-1.5 backdrop-blur-sm",
        className
      )}
    >
      <ShinyPill
        text={children}
        textColor="#979c9d"
        shineColor="#6bc0a8"
        speed={3.2}
        font={
          {
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: "11px",
            letterSpacing: "0.14em",
            lineHeight: "1em",
            textTransform: "uppercase",
          } as React.CSSProperties
        }
        leading={
          dot ? (
            <span className="bg-primary size-1.5 rounded-full shadow-[0_0_8px_var(--accent)]" />
          ) : undefined
        }
      />
    </span>
  );
}
