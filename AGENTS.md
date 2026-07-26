# AGENTS.md — start here

**beide** is a Windows-first Electron desktop IDE with a built-in AI coding
agent. Electron 40 + electron-vite, React 19, TypeScript strict, Zustand,
Monaco, Tailwind v4 + shadcn, i18next (ru default, en fallback), optional
Supabase account. The agent runtime is `@earendil-works/pi-coding-agent` and
runs **only** in the main process.

You are editing the IDE itself, not a project inside it.

## Read before you touch

| Doc | When |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | anything structural: processes, services, stores, storage |
| [docs/IPC.md](docs/IPC.md) | adding or changing anything on `window.beide` |
| [docs/CHAT-AND-SESSIONS.md](docs/CHAT-AND-SESSIONS.md) | the transcript, streaming, persistence — **read it before editing `src/stores/chat.ts`** |
| [docs/AGENT-RUNTIME.md](docs/AGENT-RUNTIME.md) | pi session, models, providers, permissions, checkpoints |
| [docs/UI.md](docs/UI.md) | layout, design tokens, Agent Elements, i18n |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | commands, running and debugging the app, conventions |
| [docs/KNOWN-GAPS.md](docs/KNOWN-GAPS.md) | what is deliberately missing or half-wired |
| [BEIDE.md](BEIDE.md) · [.beide/rules.md](.beide/rules.md) | product policy the in-app agent must not regress |
| [specs/](specs/) | original product/architecture briefs (historical, may be stale) |

## Hard rules

1. **Process boundary.** Renderer (`src/`) imports no `node:*`, no `electron`,
   no pi SDK. Main (`electron/`) renders no UI. Everything crosses through the
   preload bridge.
2. **One IPC contract.** A capability exists in `src/lib/types.ts`,
   `electron/preload.ts` and `electron/ipc.ts` — or it does not exist. Validate
   every argument in the handler (`electron/services/ipc-utils.ts`).
3. **Never touch credentials.** `~/.pi/agent/auth.json` is pi's. Inspect key
   names and types if you must; never read, copy, print or log a token. No
   secrets in the repo.
4. **Plan mode never writes.** Agent mode respects `permissionMode` (`ask`
   surfaces a diff, `auto` allows) and snapshots a checkpoint before mutating.
5. **The transcript is fragile.** Its invariants are listed in
   [docs/CHAT-AND-SESSIONS.md](docs/CHAT-AND-SESSIONS.md); each one is there
   because it broke in production. Do not "simplify" them away.
6. **Design tokens, not hex.** Colours come from `src/styles/themes.css`;
   user-visible strings come from `src/i18n/{ru,en}.json` — both files, always.
7. **No new stack.** Don't add a second UI kit, state library, or markdown
   renderer. New dependencies need a reason stated in the change.

## Definition of done

```bash
npm run typecheck   # node + web projects
npm test            # backend invariant harness
npm run dev         # then actually look at the change in the app
```

Smoke: window opens with the custom title bar, no renderer crash on an empty
workspace, a chat turn renders (user row → thinking → tool cards → answer) and
survives a reload.

Report honestly: if something is unverified, say so.
