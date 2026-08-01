import { cn } from "./utils/cn";

export type SpiralLoaderProps = {
  size?: number;
  className?: string;
};

/**
 * CSP-safe spiral loader. The former lottie-web implementation evaluates
 * generated JavaScript at runtime, which production's script-src correctly
 * rejects — this is the same swirl drawn as a static Archimedean spiral path
 * (2.6 turns, generated offline) rotated by a stylesheet animation.
 */
export function SpiralLoader({ size = 16, className }: SpiralLoaderProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn(
        "shrink-0 animate-spin [animation-duration:1.4s] text-current",
        className,
      )}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12.30 12.00 L12.42 12.11 L12.50 12.27 L12.51 12.48 L12.45 12.70 L12.30 12.92 L12.08 13.10 L11.78 13.21 L11.43 13.24 L11.06 13.17 L10.69 12.98 L10.37 12.67 L10.12 12.27 L9.98 11.78 L9.97 11.24 L10.12 10.69 L10.41 10.16 L10.86 9.71 L11.43 9.36 L12.11 9.17 L12.84 9.16 L13.59 9.34 L14.29 9.72 L14.90 10.29 L15.36 11.02 L15.63 11.88 L15.67 12.81 L15.48 13.75 L15.04 14.65 L14.36 15.42 L13.49 16.03 L12.46 16.40 L11.34 16.51 L10.19 16.33 L9.09 15.85 L8.13 15.10 L7.36 14.10 L6.85 12.91 L6.66 11.60 L6.80 10.25 L7.28 8.94 L8.09 7.77 L9.20 6.82 L10.54 6.16 L12.03 5.84 L13.58 5.91 L15.10 6.38 L16.49 7.22 L17.65 8.41 L18.49 9.88 L18.94 11.54 L18.97 13.29 L18.55 15.03 L17.70 16.65 L16.46 18.02 L14.88 19.06 L13.06 19.68 L11.11 19.84 L9.15 19.50 L7.31 18.67 L5.70 17.39 L4.45 15.72 L3.63 13.77 L3.32 11.63 L3.55 9.46 L4.33 7.38"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
