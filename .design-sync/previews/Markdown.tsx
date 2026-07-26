import { Markdown } from "beide";

const PROSE = `## Refactoring the session store

The store now keeps a single \`sessions\` map keyed by id, so a resume no longer
has to walk the whole history. Three things changed:

1. \`loadSession\` returns the hydrated record instead of mutating in place.
2. Checkpoints are written **after** the tool result lands, never before.
3. Aborted turns keep their partial assistant message so the UI can show it.

> Migration note: existing \`.beide/sessions/*.json\` files are read as-is — the
> new fields are optional and default on read.

See [the checkpoint service](#checkpoints) for the write path.
`;

const CODE = `Patch the guard so an empty workspace can't crash startup:

\`\`\`ts
export function getBeide(): BeideApi | null {
  if (typeof window === "undefined") return null;
  return window.beide ?? null;
}
\`\`\`

Then run:

\`\`\`bash
npm run typecheck && npm run build
\`\`\`
`;

const TABLE = `### Tool permissions

| Tool | Default | Ask on first use |
| --- | --- | --- |
| Read | allow | no |
| Edit | ask | yes |
| Bash | ask | yes |
| WebFetch | deny | — |

Set them per workspace in \`Settings → Permissions\`.
`;

const INLINE = `Inline elements: **bold**, *italic*, \`inline code\`, a
[link](https://example.com), and a horizontal rule below.

---

- Nested lists work too:
  - second level
  - with \`code\` inside
- And stay tight, without extra paragraph spacing.
`;

export function Prose() {
  return (
    <div className="max-w-prose">
      <Markdown content={PROSE} />
    </div>
  );
}

export function CodeBlocks() {
  return (
    <div className="max-w-prose">
      <Markdown content={CODE} />
    </div>
  );
}

export function Table() {
  return (
    <div className="max-w-prose">
      <Markdown content={TABLE} />
    </div>
  );
}

export function InlineFormatting() {
  return (
    <div className="max-w-prose">
      <Markdown content={INLINE} />
    </div>
  );
}
