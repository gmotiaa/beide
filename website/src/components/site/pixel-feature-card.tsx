import * as React from "react";

import PixelCard from "@/components/originkit/pixel-card";
import { FeatureIcon } from "@/components/site/feature-icon";
import { Badge } from "@/components/ui/badge";

/** Accent-tinted pixels so the hover reads as the same palette as the app. */
const PIXELS = ["#2b2f31", "#3d6b5f", "#4fa88f", "#6bc0a8"];

type PixelFeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  tag?: string;
  /** Index in the grid — staggers where the pixels start growing from. */
  index?: number;
};

const APPEAR = ["middle", "left", "bottom", "right", "top"] as const;

/**
 * A feature tile whose surface fills with pixels on hover (Origin Kit PixelCard)
 * while the copy stays flat on top of it.
 */
export function PixelFeatureCard({
  icon,
  title,
  description,
  tag,
  index = 0,
}: PixelFeatureCardProps) {
  return (
    <PixelCard
      colors={PIXELS}
      gap={5}
      pixelSize={2}
      speed={70}
      appearFrom={APPEAR[index % APPEAR.length]}
      backgroundColor="#1a1d1f"
      borderColor="#2b2f31"
      borderWidth={1}
      radius={12}
      style={{ minHeight: 0, height: "100%" }}
      contentStyle={{ display: "block", pointerEvents: "none" }}
    >
      <div className="flex h-full flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <FeatureIcon name={icon} />
          {tag ? <Badge variant="outline">{tag}</Badge> : null}
        </div>
        <h3 className="text-[17px] leading-snug font-medium">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </PixelCard>
  );
}

/** Same surface, arbitrary content — used for stat and callout tiles. */
export function PixelTile({
  children,
  appearFrom = "middle",
  className,
}: {
  children: React.ReactNode;
  appearFrom?: (typeof APPEAR)[number];
  className?: string;
}) {
  return (
    <PixelCard
      colors={PIXELS}
      gap={6}
      pixelSize={2}
      speed={60}
      appearFrom={appearFrom}
      backgroundColor="#1a1d1f"
      borderColor="#2b2f31"
      borderWidth={1}
      radius={12}
      style={{ minHeight: 0, height: "100%" }}
      contentStyle={{ display: "block", pointerEvents: "none" }}
    >
      <div className={className}>{children}</div>
    </PixelCard>
  );
}
