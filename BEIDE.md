# beide — agent rules (this repo)

You are working **inside the beide codebase** (the IDE itself). Follow these rules.
Deeper context lives in [AGENTS.md](AGENTS.md) and [docs/](docs/) — this file is
the short policy the agent must not regress.

## Stack (do not replace)

- Electron 40 + electron-vite + React 19 + TypeScript strict
- Monaco, Zustand, i18next, Tailwind v4 + shadcn, vendored Agent Elements
- Terminal is a `shell:run` pipe, not a PTY — there is no xterm/node-pty here
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

- Colours come from the palette in `src/styles/themes.css` (`light`, `dark`,
  `midnight`) — use tokens, never a literal hex in a component
- Cursor-like layout: activity bar | sidebar | editor | chat

## Agent / product behavior (do not regress)

- Plan mode: no file writes (the tool allowlist excludes `edit`/`write`)
- Agent mode: full tools, respect `permissionMode` ask|auto
- Checkpoint before agent mutations
- Model catalog is `src/lib/models.ts` — one source of truth; an unavailable
  provider falls back to the first available model and emits `beide:warning`
- The transcript invariants in [docs/CHAT-AND-SESSIONS.md](docs/CHAT-AND-SESSIONS.md)
  are regression fixes — read that file before touching `src/stores/chat.ts`
- Project rules: read `BEIDE.md` and `.beide/rules.md` when present in **user** workspaces (not only this monorepo)

## When changing IPC

1. Update `src/lib/types.ts` (`BeideApi`)
2. Mirror handlers in `electron/` preload + ipc
3. Keep event names stable (`agent:event`, `agent:permission`, `workspace:changed`)

## Out of scope unless asked

- Extension marketplace, full LSP, multi-agent swarms, packaging/auto-update
- macOS/Linux polish
- Expanding dependencies without noting why

(Supabase accounts exist but are optional — the app must keep working signed out.)

## Verify before done

```bash
npm run typecheck
npm test
npm run dev
```

Smoke: window opens, title "beide", no renderer crash on empty workspace, a chat
turn renders and survives a reload.
