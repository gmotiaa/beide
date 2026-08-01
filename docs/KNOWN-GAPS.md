# Known gaps

Deliberate holes, half-wired modules and things that will bite. Update this
file when you close one.

## Workspace restore caveats

The last workspace is remembered (`settings.json` `lastWorkspacePath`, plus a
cloud copy in `user_settings.last_workspace_path`) and reopened on boot;
the active chat is restored from `<workspace>/.beide/active-session.json`.
Remaining holes:

* There is still no CLI/env way to open an arbitrary folder (handy for
  debugging — see [DEVELOPMENT.md](DEVELOPMENT.md#driving-the-running-app-cdp)).
* A moved/renamed workspace silently falls back to the empty state.

## Unwired modules

None currently. `supabase-settings.ts` is wired into the workspace restore;
`supabase-admin.ts` and the subagent tool renderer were deleted. Do not let a
new list accumulate — wire or delete.

## Testing

No test framework. `npm test` runs a single hand-written harness over twelve
backend invariants (`electron/services/verification.test.ts`); the renderer
stores, the IPC layer end-to-end and every React component are uncovered. The
chat store is the highest-risk uncovered code.

## Terminal

`TerminalPanel` is now a real PTY: ConPTY via `@lydell/node-pty` (prebuilt
binary, no native rebuild) behind `terminal:create`/`write`/`resize`/`kill`,
rendered with `@xterm/xterm`, up to 8 tabs (`MAX_TABS` in
`TerminalPanel.tsx`, mirrored server-side by `MAX_TERMINALS` in
`electron/services/terminal.ts`). Interactive programs and ANSI-heavy TUIs
work. Still missing:

* No shell picker — always the system default (`cmd.exe`/`COMSPEC` on
  Windows).
* No persistence across app restarts: tabs and their running shells die with
  the window; reopening the app always starts with one fresh tab.
* The agent's own `bash` tool is unrelated and unchanged — it still runs
  through `shell:run` (`cmd.exe /c`, 30 s timeout, no PTY), not the terminal
  panel's PTY (see [AGENT-RUNTIME.md](AGENT-RUNTIME.md)).

## Packaging

`electron-builder.yml` produces installer and portable Windows artifacts.
Auto-update is wired (electron-updater, generic feed in `publish.url`) but the
feed URL is still a placeholder — until real hosting serves `latest.yml` + the
installers, the check fails silently on every launch. Builds are still
unsigned: updates work, but Windows shows the unknown-publisher prompt; fixing
that needs a real certificate (`win.certificateFile`).

There is also no crash reporting: Sentry (or any equivalent) is not
integrated anywhere in the app — a renderer or main-process crash leaves
nothing but whatever the user saw on screen. Wiring it needs a DSN and a
decision on what to redact before upload (chat content, file paths).

## Editor intelligence

Monaco's own TypeScript/JS worker is the only "language server" in the app —
there is no LSP client, so non-TS languages (Python, Go, Rust, …) get syntax
highlighting only: no real diagnostics, go-to-definition or completions
beyond Monaco's built-ins. The "Editor diagnostics (open tabs)" block fed to
the agent (see [AGENT-RUNTIME.md](AGENT-RUNTIME.md)) is only as good as
whatever Monaco itself can produce for the language.

`@codebase` search (chat mentions and the composer's `@codebase <query>`) is
lexical only — `WorkspaceService.searchContent()` is a text/regex grep over
files, not a semantic or embedding-based index. There is no vector store and
no ranking beyond match position; a query has to share vocabulary with the
code it should find.

## Bundle size

Monaco (~6.4 MB) is a lazy chunk behind `React.lazy(EditorArea)`; syntax
grammars load on demand. The eager entry chunk is ~4.6 MB — further trimming
means lazy-loading the chat markdown renderer, which has not been worth the
mid-stream flicker risk so far.

## Localisation

`beide:warning` messages emitted from `electron/services/agent.ts` are Russian
string literals in main, outside the i18n resources. An English user sees
Russian warnings.

## Retention limits

* Sessions: newest 80 kept (`MAX_SESSIONS`), 2 000 messages per file.
* Checkpoints: newest 40 kept.
* Chat images over 2 000 base64 chars are dropped before saving, so a reloaded
  transcript shows the text of an image-bearing message but not the image.

## Accounts and usage

Supabase auth is mandatory: `App.tsx` blocks the IDE behind `AuthGate` until a
session exists. Usage counters live only in Supabase (`get_billing` /
`spend_tokens` RPCs, atomic and server-gated); the old local
`%APPDATA%/beide/usage.json` backend was removed. The pre-check in
`src/lib/usage.ts` is a client-side convenience — the server ledger is the
enforcement.

The model-provider key is delivered from Supabase after sign-in
(`get_encrypted_model_api_key()` → `agent:installProviderKey` → AES-256-GCM
decrypt in main, memory only). Honest caveat: the decryption key ships inside
the app (`electron/services/provider-key.ts`), so this is defence in depth
against casual extraction, not true secrecy — that would need a server-side
proxy for all model traffic. `BEIDE_ECHOGATE_API_KEY` in `.env` remains a dev
override. Publish/rotate the cloud key with `npm run supabase:secrets`.

Chat sessions now have a cloud write-through backup: after every local
`session:save`, the renderer also upserts the transcript to
`public.chat_sessions` (owner-only RLS, keyed by a client-side hash of the
workspace root, fire-and-forget — see
[CHAT-AND-SESSIONS.md](CHAT-AND-SESSIONS.md)). The local `.beide/sessions/`
files remain the source of truth; the cloud copy is a fallback surfaced in
chat history's "From the cloud" section (`session:import` to restore), useful
after a fresh machine or a wiped `.beide` folder. There is no cloud→local
sync in the other direction beyond that manual restore.
