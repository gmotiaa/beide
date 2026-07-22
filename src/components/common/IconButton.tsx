import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

export function IconButton({
  label,
  active,
  children,
  className = "",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn${active ? " is-active" : ""}${className ? ` ${className}` : ""}`}
      title={label}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export const Icons = {
  files: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 6h16v12H4z" />
      <path d="M7 10l3 2-3 2M12 14h5" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 5h14v10H8l-3 3V5z" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M4 12l16-7-7 16-2-7-7-2z" />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="M4 16l5-4 4 3 3-2 4 3" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};
