# .beide/rules.md

Workspace-level rules for the beide agent. Loaded when this file exists at `{workspace}/.beide/rules.md` (alongside optional root `BEIDE.md`).

## For this repository

Same as root [`BEIDE.md`](../BEIDE.md). Prefer the root file for full project policy; keep this file short for agent context budget.

### Priorities

1. Do not break the main/renderer split.
2. Keep `window.beide` types honest.
3. Dark UI tokens and i18n for user-visible strings.
4. Plan mode never writes; ask mode always surfaces diff before apply.

### Ignore

- `node_modules/`, `out/`, `dist/`, `.beide/checkpoints/`, `.beide/sessions/`
- Generated build artifacts

### Edits

- Touch only files required for the task
- After IPC or settings shape changes, update types + both process sides
