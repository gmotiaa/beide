# beide — agent rules (this repo)

You are working **inside the beide codebase** (the IDE itself). Follow these rules.

## Stack (do not replace)

- Electron + electron-vite + React 18 + TypeScript strict
- Monaco, Zustand, i18next, xterm
- Agent runtime: `@earendil-works/pi-coding-agent` in **main process only**
- UI talks via `window.beide` (see `src/lib/types.ts`)

## Boundaries

- **Main** (`electron/`): fs, agent, permissions, checkpoints, settings, sessions
- **Renderer** (`src/`): UI only — no direct Node fs, no pi SDK import
- **Preload**: thin typed bridge; keep it small
- Do not put secrets in the repo. Auth lives in `~/.pi/agent`

## Code style

- Identifiers and file names in English
- UI strings through i18n keys (`ru` + `en`) when touching visible text
- No pseudo-code, no crashing TODOs — stub with working empty states
- Prefer small modules over god-files
- Match existing patterns in the folder you edit

## UI defaults

- Dark premium: bg `#0d0d10`, panel `#141418`, border `#2a2a32`, accent `#7C5CFF`, text `#ececf1`
- Cursor-like layout: activity bar | sidebar | editor | chat

## Agent / product behavior (do not regress)

- Plan mode: no file writes
- Agent mode: full tools, respect `permissionMode` ask|auto
- Checkpoint before agent mutations
- Project rules: read `BEIDE.md` and `.beide/rules.md` when present in **user** workspaces (not only this monorepo)

## When changing IPC

1. Update `src/lib/types.ts` (`BeideApi`)
2. Mirror handlers in `electron/` preload + ipc
3. Keep event names stable (`agent:event`, `agent:permission`, `workspace:changed`)

## Out of scope unless asked

- Extension marketplace, full LSP, multi-agent swarms, cloud accounts
- macOS/Linux polish
- Expanding dependencies without noting why

## Verify before done

```bash
npm run typecheck
npm run dev
```

Smoke: window opens, title "beide", no renderer crash on empty workspace.
