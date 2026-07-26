/**
 * Locally generated artwork for the gallery components.
 *
 * The Originkit galleries ship with images hosted on their CDN; those are
 * stripped out of the vendored components, so the site renders its own SVG
 * "editor panes" instead. Everything is a data URI — no network, no binaries.
 */

const PALETTE = [
  { accent: "#4fa88f", tint: "#6bc0a8" },
  { accent: "#d2a047", tint: "#e0b96f" },
  { accent: "#d2694e", tint: "#e08a72" },
  { accent: "#82b173", tint: "#a0c894" },
  { accent: "#6b8fd2", tint: "#8fabdf" },
  { accent: "#a97bd2", tint: "#c09ee0" },
];

/** Deterministic pseudo-random so re-renders keep the same artwork. */
function rng(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

type ShotOptions = {
  seed: number;
  width: number;
  height: number;
  label?: string;
};

function pane({ seed, width, height, label }: ShotOptions): string {
  const rand = rng(seed);
  const { accent, tint } = PALETTE[seed % PALETTE.length];

  const chrome = Math.round(height * 0.075);
  const sidebar = Math.round(width * 0.24);
  const padding = Math.round(width * 0.045);
  const lineH = Math.max(3, Math.round(height * 0.026));
  const gap = Math.round(lineH * 1.85);
  const rows = Math.floor((height - chrome - padding * 2) / gap);

  const codeLines: string[] = [];
  for (let i = 0; i < rows; i++) {
    const indent = Math.floor(rand() * 3) * (width * 0.035);
    const segments = 1 + Math.floor(rand() * 3);
    let x = sidebar + padding + indent;
    const y = chrome + padding + i * gap;
    for (let s = 0; s < segments; s++) {
      const w = (width - sidebar - padding * 2 - indent) * (0.14 + rand() * 0.3);
      if (x + w > width - padding) break;
      const roll = rand();
      const fill =
        roll > 0.86 ? accent : roll > 0.72 ? tint : roll > 0.4 ? "#5e6668" : "#3a4144";
      const opacity = roll > 0.72 ? 0.9 : 0.62;
      codeLines.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(
          1
        )}" height="${lineH}" rx="${(lineH / 2).toFixed(
          1
        )}" fill="${fill}" opacity="${opacity}"/>`
      );
      x += w + width * 0.022;
    }
  }

  const treeRows = Math.floor((height - chrome - padding * 2) / (gap * 1.15));
  const tree: string[] = [];
  for (let i = 0; i < treeRows; i++) {
    const indent = Math.floor(rand() * 3) * (width * 0.028);
    const w = (sidebar - padding * 2 - indent) * (0.45 + rand() * 0.5);
    const y = chrome + padding + i * gap * 1.15;
    tree.push(
      `<rect x="${(padding + indent).toFixed(1)}" y="${y.toFixed(
        1
      )}" width="${Math.max(6, w).toFixed(1)}" height="${lineH}" rx="${(
        lineH / 2
      ).toFixed(1)}" fill="#4a5153" opacity="0.7"/>`
    );
  }

  const dot = (cx: number, fill: string) =>
    `<circle cx="${cx}" cy="${(chrome / 2).toFixed(1)}" r="${(
      chrome * 0.16
    ).toFixed(1)}" fill="${fill}"/>`;

  const caption = label
    ? `<text x="${padding}" y="${(height - padding * 0.6).toFixed(
        1
      )}" font-family="monospace" font-size="${Math.round(
        height * 0.036
      )}" fill="${accent}" opacity="0.85">${label}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" fill="#141618"/>
<rect x="0" y="0" width="${sidebar}" height="${height}" fill="#1a1d1f"/>
<rect x="0" y="0" width="${width}" height="${chrome}" fill="#1c1f21"/>
<line x1="${sidebar}" y1="${chrome}" x2="${sidebar}" y2="${height}" stroke="#2b2f31" stroke-width="1"/>
<line x1="0" y1="${chrome}" x2="${width}" y2="${chrome}" stroke="#2b2f31" stroke-width="1"/>
${dot(padding, "#d2694e")}${dot(padding + chrome * 0.45, "#d2a047")}${dot(
    padding + chrome * 0.9,
    "#82b173"
  )}
${tree.join("")}
${codeLines.join("")}
<rect x="0" y="${height - chrome * 0.35}" width="${width}" height="${
    chrome * 0.35
  }" fill="${accent}" opacity="0.55"/>
${caption}
</svg>`;
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function makeShot(options: ShotOptions): string {
  return toDataUri(pane(options));
}

const PORTRAIT_LABELS = [
  "agent.ts",
  "diff.tsx",
  "chat.ts",
  "main.ts",
  "ipc.ts",
  "tree.tsx",
  "editor.tsx",
  "rules.md",
  "usage.ts",
  "themes.css",
  "models.ts",
  "session.ts",
];

/** Two rows of portrait panes for the Eye Gallery ticker. */
export const EYE_TOP = PORTRAIT_LABELS.slice(0, 6).map((label, i) => ({
  image: { src: makeShot({ seed: i + 1, width: 300, height: 400, label }), alt: label },
  focusY: 50,
}));

export const EYE_BOTTOM = PORTRAIT_LABELS.slice(6).map((label, i) => ({
  image: {
    src: makeShot({ seed: i + 7, width: 300, height: 400, label }),
    alt: label,
  },
  focusY: 50,
}));

/** Square panes for the Gallery Tunnel walls. */
export const TUNNEL_IMAGES = Array.from({ length: 10 }).map((_, i) => ({
  src: makeShot({ seed: i + 13, width: 512, height: 512 }),
  alt: `beide pane ${i + 1}`,
}));
