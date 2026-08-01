# IPC reference

Every renderer capability goes through `window.beide`. The contract lives in
`src/lib/types.ts` (`BeideApi`); `electron/preload.ts` mirrors it 1:1 and
`electron/ipc.ts` implements it.

## Changing the surface

1. Edit `BeideApi` in `src/lib/types.ts`.
2. Add the passthrough in `electron/preload.ts`.
3. Add `rehandle("<channel>", …)` in `electron/ipc.ts`, validating every
   argument with the helpers from `electron/services/ipc-utils.ts`.
4. `npm run typecheck` — all three sides are typed, so a mismatch fails here.

Never invent a channel name in the renderer. Never widen `ALLOWED_EVENTS` in
the preload without a reason: it is the whitelist for main → renderer pushes.

## Request/response channels

| Channel | Renderer call | Notes |
| --- | --- | --- |
| `workspace:pickFolder` | `workspace.pickFolder()` | native folder dialog only; does not mutate the active workspace |
| `workspace:setRoot` | `workspace.setRoot(path)` | validates and activates a picked directory after renderer dirty/session guards |
| `workspace:getRoot` | `workspace.getRoot()` | `null` until a folder is opened |
| `workspace:readDir` | `workspace.readDir(path?)` | gitignore-aware, cached 5 s |
| `workspace:readFile` / `workspace:writeFile` | same | editor saves bypass the agent permission gate by design |
| `workspace:search` | `workspace.searchFiles(query)` | filename search |
| `workspace:pathExists`, `workspace:delete`, `workspace:rename`, `workspace:reveal` | same | all paths resolved through `resolveInWorkspace` |
| `agent:prompt` | `agent.prompt(payload)` | payload validated + clamped (see limits) |
| `agent:abort` | `agent.abort()` | |
| `agent:setMode` | `agent.setMode("plan" \| "agent")` | tears down and lazily recreates the pi session |
| `agent:setModel` | `agent.setModel(id)` | id must exist in `src/lib/models.ts` |
| `agent:respondPermission` | `agent.respondPermission(id, allow, content?)` | answers an `agent:permission` push |
| `agent:getStatus` | `agent.getStatus()` | `{ ready, streaming, mode, model? }` |
| `agent:getProviders` | `agent.getProviders()` | `ProviderStatus[]` — connection state only, never tokens |
| `agent:health` | `agent.probeGateway()` | `{ ok, latencyMs }` — cheap reachability probe behind the status-bar badge, polled every 90 s |
| `ai:complete` | `agent.complete(payload)` | one-shot non-agentic completion (no session, no tools); powers Ctrl+K inline edit, ghost text, commit-message generation |
| `checkpoint:list` / `checkpoint:restore` | same | |
| `checkpoint:entries` | `checkpoint.entries(id)` | per-file snapshot paired with current content, for the agent-changes diff view |
| `settings:get` / `settings:set` | same | `set` returns the merged settings |
| `session:list` | `session.list()` | newest first |
| `session:active` | `session.active()` | id main is currently appending to, or `null` |
| `session:load` | `session.load(id)` | also makes that session active |
| `session:new` | `session.new()` | creates the file and makes it active |
| `session:save` | `session.save(id, messages)` | full replace of the transcript |
| `session:import` | `session.import(info, messages)` | writes a session file wholesale — used to restore a cloud-only chat into `.beide/sessions/` |
| `session:delete` | `session.delete(id)` | |
| `shell:run` | `shell.run(command)` | `cmd.exe /c` on Windows, 30 s timeout — not a PTY; this is the agent's `bash` tool path, unrelated to the terminal panel |
| `git:status` | `git.status()` | `{ isRepo, branch, status }` — `status` is porcelain output, parsed by the renderer |
| `git:stage` / `git:unstage` | `git.stage(path)` / `git.unstage(path)` | |
| `git:diff` | `git.diff(path, staged?)` | `{ diff }`, capped at 200 000 chars |
| `git:commit` | `git.commit(message)` | message goes through a temp file, not shell-quoted |
| `terminal:create` | `terminal.create(cols, rows)` | `{ id }` — spawns a ConPTY in the workspace root |
| `terminal:write` | `terminal.write(id, data)` | keystrokes/paste to the pty |
| `terminal:resize` | `terminal.resize(id, cols, rows)` | |
| `terminal:kill` | `terminal.kill(id)` | |
| `usage:get` / `usage:increment` | same | local plan + rolling windows |
| `usage:setPlan` / `usage:addCredits` / `usage:reset` | same | local-only debug mutations; cloud billing still goes through Supabase RPCs |
| `window:minimize` / `maximize` / `close` / `isMaximized` | same | custom title bar |

Handlers return either a bare value or the structured envelope
`{ success: true, data } | { success: false, error: { message, code } }`. The
preload unwraps it and throws on `success: false`, so the renderer just sees a
rejected promise.

## Push channels (main → renderer)

Whitelisted in `electron/preload.ts` → `ALLOWED_EVENTS`:

| Channel | Payload | Consumer |
| --- | --- | --- |
| `agent:event` | pi runtime events (deltas, tool start/end, errors, end of turn) | `useAgentStore.handleEvent` |
| `agent:permission` | `PermissionRequest` | `useAgentStore` → `DiffModal` |
| `workspace:changed` | `{ path?: string, paths?: string[], restored?: string }` | file tree refresh + reload of non-dirty tabs; restore refreshes every clean tab |
| `window:close-requested` | `{ dirty: boolean }` | main pauses close so renderer can flush chat and, when needed, confirm dirty editor buffers |
| `terminal:data` | `{ id: string, data: string }` | `TerminalPanel` writes it into the xterm instance matching `id` |
| `terminal:exit` | `{ id: string, exitCode: number }` | marks that session dead; the next keystroke spawns a fresh shell |

Subscribe with `window.beide.on(channel, cb)`; it returns an unsubscribe
function — always call it in the effect cleanup.

## Input limits (`LIMITS` in `ipc-utils.ts`)

| Key | Value |
| --- | --- |
| `path` | 1 024 chars |
| `fileContent` | 8 MB |
| `shellCommand` | 8 000 chars |
| `searchQuery` | 200 chars |
| `sessionMessages` | 2 000 messages |
| `sessionMessageChars` | 500 000 per message |
| `promptText` | 200 000 chars |
| `images` | 8 per prompt, 6 M base64 chars each |

The renderer mirrors `sessionMessages` in `src/stores/chat.ts`
(`MAX_SAVED_MESSAGES`): exceeding it makes the whole save throw, which would
silently lose a transcript.
