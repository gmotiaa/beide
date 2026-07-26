# Known gaps

Deliberate holes, half-wired modules and things that will bite. Update this
file when you close one.

## Workspace is not remembered between launches

Main keeps the workspace root in memory only. On startup there is no folder, so
`session:*` and `checkpoint:*` throw `No workspace open` until the user picks
one through the native dialog. Consequences:

* `restoreActiveSession()` recovers a transcript after a **renderer** reload or
  crash, but not after a full app restart — `SessionService.setWorkspace()`
  clears `activeId`.
* There is no CLI/env way to open a folder (handy for debugging — see
  [DEVELOPMENT.md](DEVELOPMENT.md#driving-the-running-app-cdp)).

`src/lib/supabase-settings.ts` already models `last_workspace_path` but is not
imported anywhere. Closing this gap means: persist the root (locally, and
optionally in Supabase), reopen it on boot, then restore the active session.

## Unwired modules

| Module | State |
| --- | --- |
| `src/lib/supabase-settings.ts` | cloud settings read/write, no caller |
| `electron/services/supabase-admin.ts` | service-role helpers, no IPC handler |
| `src/components/agent-elements/tools/subagent-tool.tsx` | no `Task`/subagent renderer is registered |

Either wire them or delete them — do not let the list grow.

## Testing

No test framework. `npm test` runs a single hand-written harness over five
backend invariants (`electron/services/verification.test.ts`); the renderer
stores, the IPC layer end-to-end and every React component are uncovered. The
chat store is the highest-risk uncovered code.

## Terminal

`TerminalPanel` shells out through `shell:run` (`cmd.exe /c`, 30 s timeout). No
PTY, no interactive programs, no ANSI-heavy TUIs. A real terminal needs
`node-pty` + `@xterm/xterm`, neither of which is installed.

## Packaging

There is no `electron-builder` (or Forge) configuration — `npm run build` only
produces `out/`. Icons exist in `build/` and `public/` for when packaging is
added. No auto-update, no code signing.

## Bundle size

The renderer chunk is ~11 MB, dominated by Monaco plus streamdown's syntax
grammars. No manual chunking or lazy loading is configured; the build prints
size warnings and that is expected today.

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

Supabase auth is optional and the app works fully signed out. Usage counters
(`%APPDATA%/beide/usage.json`) are local and trivially editable — they are a UI
affordance, not enforcement.
