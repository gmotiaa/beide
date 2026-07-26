# Architecture

beide is an Electron desktop IDE with a built-in AI coding agent. Three
processes, one bridge, no exceptions.

```
┌─ main (electron/) ───────────────┐        ┌─ renderer (src/) ─────────────┐
│ fs, agent runtime, permissions,  │  IPC   │ React 19 UI, Zustand stores,  │
│ checkpoints, sessions, settings, │◄──────►│ Monaco, i18n. No Node APIs.   │
│ usage                            │        │                               │
└──────────────────────────────────┘        └───────────────────────────────┘
                    ▲  contextBridge (electron/preload.ts) — thin, typed
```

* **Main** owns everything privileged: the filesystem, the pi agent runtime,
  permission prompts, checkpoints, session files, settings, usage counters.
* **Renderer** is UI only. It never imports `node:*`, `electron`, or the pi SDK.
  Every capability arrives through `window.beide`.
* **Preload** (`electron/preload.ts`) exposes exactly the surface declared in
  `src/lib/types.ts` → `BeideApi`. Adding a capability means touching all three:
  type, preload, IPC handler.

## Entry points

| File | Role |
| --- | --- |
| `electron/main.ts` | app lifecycle, single-instance lock, `BrowserWindow`, env loading |
| `electron/ipc.ts` | service construction + every `ipcMain.handle` registration |
| `electron/preload.ts` | `contextBridge.exposeInMainWorld("beide", api)` |
| `src/main.tsx` | React root, global CSS, i18n, monaco setup |
| `src/App.tsx` | first-run intro gate → onboarding gate → `AppLayout` |

`electron.vite.config.ts` builds main as **ESM** (pi is ESM-only) and preload as
**CJS** (required for `contextBridge`). Renderer alias: `@` → `src`.

## Main-process services (`electron/services/`)

| Service | Responsibility | State on disk |
| --- | --- | --- |
| `workspace.ts` | root folder, dir listing (gitignore-aware), read/write, search, watch | — |
| `agent.ts` | pi session, model/provider resolution, tools, prompt/abort, event fan-out | — |
| `permissions.ts` | ask/auto gate for write/edit/bash | — |
| `checkpoints.ts` | pre-mutation snapshots + restore | `<workspace>/.beide/checkpoints/` |
| `sessions.ts` | chat transcripts, active session id | `<workspace>/.beide/sessions/*.json` |
| `settings.ts` | user settings + file watch | `%APPDATA%/beide/settings.json` |
| `usage.ts` | token counters for the 5h/week windows; the allocation rule itself is `applySpend` in `src/lib/usage.ts`, shared with the renderer | `%APPDATA%/beide/usage.json` |
| `paths.ts` | path safety (`resolveInWorkspace`), gitignore matcher, `.beide` layout |  — |
| `ipc-utils.ts` | argument validation, `IpcError`, `{success,data,error}` envelope | — |
| `supabase-admin.ts` | service-role helpers (**not wired to any IPC handler**) | — |

Services are created once in `createServices()` and handed to `registerIpc()`.
`registerIpc` is idempotent (`rehandle` replaces an existing handler), so a hot
reload of main does not throw "second handler for channel".

## Renderer stores (`src/stores/`)

| Store | Owns |
| --- | --- |
| `workspace.ts` | root path, file tree, expanded nodes |
| `editor.ts` | open tabs, dirty state, active tab, save |
| `chat.ts` | the transcript — see [CHAT-AND-SESSIONS.md](CHAT-AND-SESSIONS.md) |
| `agent.ts` | agent status/mode/model, `agent:event` → chat store translation, permission requests |
| `settings.ts` | mirrors `BeideSettings`, applies theme + language |
| `auth.ts` | Supabase session (optional; app works fully signed-out) |
| `usage.ts` | usage counters; Supabase snapshot when signed in, local file otherwise. `src/lib/usage.ts` stays language-free — the store maps denial codes to i18n strings |
| `onboarding.ts` | first-run flags in `localStorage` (`completed`, `introSeen`) |

Data flows one way: IPC event → `useAgentStore.handleEvent` → mutations on
`useChatStore` → React re-render. Components never call IPC for transcript
state.

## Component map (`src/components/`)

* `layout/` — `AppLayout` (grid), `TitleBar` (custom window chrome),
  `ActivityBar`, `StatusBar`.
* `sidebar/` — `FileTree`, `SearchPanel`.
* `editor/` — `EditorArea` (Monaco), `TabBar`.
* `chat/` — `ChatPanel` (the agent surface), `ChatHistory` (session list).
* `agent-elements/` — vendored [Agent Elements](https://agent-elements.21st.dev)
  registry: message list, input bar, tool cards. See [UI.md](UI.md).
* `ui/` — shadcn primitives. Only components actually imported live here.
* `diff/DiffModal.tsx` — permission prompt with a diff view.
* `settings/` — `SettingsView.tsx` is only the shell (hero + section nav);
  each section lives in `sections.tsx`, the quota screen in `UsageSection.tsx`,
  the shared row/field/choice primitives in `parts.tsx`, and the pure helpers in
  `helpers.ts` (kept out of the `.tsx` files so Fast Refresh keeps working).
* `onboarding/Onboarding.tsx`,
  `onboarding/FirstRunIntro.tsx` (splash + WebAudio chime on the very first
  launch; sounds are synthesised in `src/lib/sound.ts` because the CSP has no
  `media-src`).

## Storage summary

| What | Where |
| --- | --- |
| Chat transcripts | `<workspace>/.beide/sessions/<id>.json` |
| Checkpoints | `<workspace>/.beide/checkpoints/<id>/` |
| Project rules for the agent | `<workspace>/BEIDE.md`, `<workspace>/.beide/rules.md` |
| App settings / usage | `%APPDATA%/beide/{settings,usage}.json` |
| Agent credentials | `~/.pi/agent/auth.json` — **owned by pi, never read or logged by beide** |
| Provider keys / Supabase config | `.env` (git-ignored), `.env.example` documents the keys |
