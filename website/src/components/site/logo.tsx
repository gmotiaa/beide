import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7", className)}
      aria-hidden
      fill="none"
    >
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        stroke="var(--primary)"
        strokeWidth="1.5"
        opacity="0.55"
      />
      <path
        d="M11 21V9.5h4.4c2.3 0 3.7 1.1 3.7 2.9 0 1.3-.7 2.2-1.9 2.5v.1c1.5.2 2.5 1.3 2.5 2.8 0 2-1.6 3.2-4.2 3.2H11Z"
        fill="var(--primary)"
      />
      <path
        d="M22.5 12.5 25.5 16l-3 3.5"
        stroke="var(--primary-bright)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">beide</span>
    </span>
  );
}
