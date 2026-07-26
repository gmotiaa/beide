# Development

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | electron-vite dev server + Electron with HMR |
| `npm run build` | builds main, preload and renderer into `out/` |
| `npm run preview` | runs the built app |
| `npm run typecheck` | `tsc --noEmit` for both the node and web projects |
| `npm test` | backend invariant harness (see below) |
| `npm run supabase:setup` | creates/updates the admin auth user (needs `BEIDE_ADMIN_EMAIL` + `BEIDE_ADMIN_PASSWORD`) |
| `npm run supabase:verify` | read-only check that the anon key reaches nothing but `plan_limits` |

The schema itself lives in `supabase/migrations/` — see
[supabase/README.md](../supabase/README.md).

Before declaring anything done: `npm run typecheck && npm test`, then launch the
app and look at the change. The build is slow (~40 s) — run it when you touched
config, main, or dependencies.

## Tests

There is no test framework. `electron/services/verification.test.ts` is a plain
`node:assert` harness covering the invariants that broke before:

1. `.gitignore` matcher semantics (negation, anchoring, directory-only rules)
2. 150 ms workspace-event debouncing
3. structured IPC envelopes and `IpcError` codes
4. binary-safe checkpoints (base64) and byte-exact restore
5. 30 ms token-delta batching

`scripts/run-ts.mjs` bundles a TS entry with esbuild (already present via vite)
and runs it in Node — the harness imports extensionless relative modules, which
Node's own type stripping cannot resolve. Add new backend invariants to that
file; anything requiring Electron APIs cannot run there.

Nothing covers the renderer stores. Verify those by driving the app.

## Running the app for verification

`npm run dev` builds main/preload, starts Vite on 5173 and launches Electron.

Gotchas that cost time before:

* **Single-instance lock.** `app.requestSingleInstanceLock()` in
  `electron/main.ts` makes a second instance quit immediately. Close the running
  app first, or launch with a separate profile:
  `npx electron . --user-data-dir=<some temp dir>`. After `taskkill`, wait a
  couple of seconds — the lock is released asynchronously.
* **No workspace on launch.** The folder is chosen through a native dialog and
  is not persisted between runs, so a fresh profile starts with no workspace and
  session IPC throws `No workspace open`. Onboarding also covers the window on a
  fresh profile ("Пропустить всё" skips it).
* **HMR reloads the renderer.** Editing renderer sources while the agent is
  streaming triggers a full page reload; the transcript is restored from the
  active session (see [CHAT-AND-SESSIONS.md](CHAT-AND-SESSIONS.md)) but any
  unsaved tail is only as fresh as the last 600 ms flush.

## Driving the running app (CDP)

Neither hook below is committed — add them temporarily when you need to inspect
a live window, then remove them.

1. In `electron/main.ts`, before `app.whenReady()`:

   ```ts
   const port = process.env.BEIDE_REMOTE_DEBUG_PORT;
   if (port && /^\d+$/.test(port)) {
     app.commandLine.appendSwitch("remote-debugging-port", port);
   }
   ```

2. In `src/main.tsx`, to reach the stores from outside:

   ```ts
   if (import.meta.env.DEV) {
     void Promise.all([import("./stores/chat"), import("./stores/agent")]).then(
       ([chat, agent]) => {
         (window as unknown as Record<string, unknown>).__beideDebug = {
           chat: chat.useChatStore,
           agent: agent.useAgentStore,
         };
       },
     );
   }
   ```

3. Launch with `BEIDE_REMOTE_DEBUG_PORT=9333 npm run dev`, then list targets at
   `http://127.0.0.1:9333/json/list` and talk to the page target over its
   WebSocket (`Runtime.evaluate`, `Page.captureScreenshot`). Node 24 has a
   global `WebSocket`, so a ~40-line script is enough.

Notes: wrap evaluated snippets in an IIFE (top-level `const` persists between
evaluations and throws "already declared" on the second run); `__beideDebug`
only exists in a dev build; and to open a workspace without the dialog you can
temporarily call `services.workspace.setRoot(path)` +
`services.agent.onWorkspaceChanged(path)` from an env var in
`registerIpc()`.

## Configuration

`.env` (git-ignored, documented by `.env.example`):

* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — optional cloud account
* `SUPABASE_SERVICE_ROLE_KEY` — main process only, or
  `%APPDATA%/beide/.beide-admin.env`
* `BEIDE_GOOGLE_API_KEY`, `BEIDE_NVIDIA_API_KEY` — provider keys

Anthropic and xAI credentials are **not** configured here: they come from
`pi auth login` in `~/.pi/agent/auth.json`.

## Conventions

* TypeScript strict; identifiers and filenames in English.
* Comments explain *why*, in the voice of the surrounding file. No banner
  comments, no "step 1/2/3" narration.
* Small modules; match the patterns of the folder you are editing.
* User-visible strings go through i18n keys in `ru` **and** `en`.
* No new dependency without a stated reason — unused ones get deleted.
* Working branch is `master`; the default branch for PRs is `main`.
