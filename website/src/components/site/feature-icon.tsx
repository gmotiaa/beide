import {
  AtSign,
  Bot,
  Code2,
  Compass,
  GitCompare,
  History,
  KeyRound,
  MessagesSquare,
  Palette,
  ScrollText,
  ShieldCheck,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  AtSign,
  Bot,
  Code2,
  Compass,
  GitCompare,
  History,
  KeyRound,
  MessagesSquare,
  Palette,
  ScrollText,
  ShieldCheck,
  Terminal,
};

export function FeatureIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Bot;
  return (
    <span
      className={cn(
        "border-border bg-panel text-primary inline-flex size-10 items-center justify-center rounded-lg border",
        className
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}
