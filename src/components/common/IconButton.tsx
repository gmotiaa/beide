/* ─────────────────────────────────────────────────────────
   Icon set — "quarry marks"

   One drawing language across the whole shell: straight lines,
   right angles, a 24px grid, square caps and mitred joins (set
   in global.css). Each glyph carries exactly one solid element
   so it still reads as a silhouette at 14px, where a purely
   outlined icon turns to mush. Solid parts must declare
   fill="currentColor" themselves — the `svg { fill: none }`
   rule only lands on the root element.
   ───────────────────────────────────────────────────────── */
export const Icons = {
  files: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6.8 4.5v13.7h4M6.8 9h4" />
      <rect x="11.2" y="6.4" width="5.2" height="5.2" fill="currentColor" stroke="none" />
      <rect x="11.2" y="15.6" width="5.2" height="5.2" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="4" width="12.5" height="12.5" />
      <path d="M16.5 16.5 20.5 20.5" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3.8 7h4.6M13 7h7.2M3.8 17h4.6M13 17h7.2" />
      <rect x="8.4" y="4.9" width="4.6" height="4.2" fill="currentColor" stroke="none" />
      <rect x="8.4" y="14.9" width="4.6" height="4.2" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.6" y="4.6" width="16.8" height="14.8" />
      <path d="M7 9.6 9.8 12.4 7 15.2" />
      <rect x="12.4" y="14.2" width="5.4" height="1.6" fill="currentColor" stroke="none" />
    </svg>
  ),
  /* The agent panel — an orbit, echoing the spiral loader. */
  chat: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M12 3.8v2.6M12 17.6v2.6" />
    </svg>
  ),
  sourceControl: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6.5 8.2v7.6M6.5 12h9.8V8.2" />
      <rect x="4.4" y="4.4" width="4.2" height="4.2" />
      <rect x="14.2" y="4.4" width="4.2" height="4.2" />
      <rect x="4.4" y="15.4" width="4.2" height="4.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 19.5V5.2M5.6 11.6 12 5.2l6.4 6.4" />
    </svg>
  ),
  stop: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="7" y="7" width="10" height="10" fill="currentColor" stroke="none" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="3.6" y="5" width="16.8" height="14" />
      <rect x="6.8" y="8.2" width="3.4" height="3.4" fill="currentColor" stroke="none" />
      <path d="M3.6 16.4 9 11.8l4 3.4 3.2-2.6 4.2 3.4" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  ),
  chevronDown: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5.5 9.5 12 16l6.5-6.5" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M6 3.5h8.2L19 8.3V20.5H6z" />
      <path d="M14.2 3.5v4.8H19" />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 5.5h6l2 2.6H20.5V19.5H3.5z" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 5.2v13.6M5.2 12h13.6" />
    </svg>
  ),
};
