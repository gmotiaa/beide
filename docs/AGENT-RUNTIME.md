# Agent runtime

The agent is [`@earendil-works/pi-coding-agent`](https://www.npmjs.com/package/@earendil-works/pi-coding-agent)
("pi"), created and driven **only** from `electron/services/agent.ts`. The
renderer never imports it.

## Session creation

```
createAgentSession({
  cwd:            workspace root       // no session until a folder is open
  agentDir:       ~/.pi/agent          // reuses the user's pi auth + models.json
  model:          resolved BeideModel
  tools:          mode-dependent allowlist
  customTools:    write / edit / bash wrappers (permissions + checkpoints)
  resourceLoader: DefaultResourceLoader({ systemPromptOverride, noExtensions: true })
  sessionManager: SessionManager.inMemory(cwd)
})
```

The system prompt is `systemBase + project rules + workspace tree snapshot`.
Project rules come from `getRulesCandidates(cwd)` — `BEIDE.md` and
`.beide/rules.md` in the **user's** workspace, not this repo.

Switching mode tears the session down and recreates it lazily. pi's in-memory
transcript is *not* carried across that boundary — the UI transcript is the
durable one (see [CHAT-AND-SESSIONS.md](CHAT-AND-SESSIONS.md)).

## Modes

| Mode | Tools |
| --- | --- |
| `plan` | `read`, `bash`, `ls`, `find`, `grep`, `todo`, `plan`, `workspace_map`, `project_info`, `git_status` |
| `agent` | all of the above **plus** `edit`, `write` |

Plan mode never writes. `bash` in plan mode blocks obvious mutators.

## Permissions and checkpoints

`write`, `edit` and `bash` are re-declared as custom tools with the same names
as the builtins, so they win the tool-registry merge. `write` and `edit`:

1. ask `PermissionGateway` (`permissionMode: "ask"` → `agent:permission` push
   to the renderer and wait for `agent:respondPermission`; `"auto"` → allow);
2. **after** the grant, snapshot the target through `CheckpointService` — a
   denied operation must not burn a checkpoint slot;
3. apply the change, or throw the denial back into the agent loop.

`bash` goes through the same permission gate (in `"ask"` mode) but takes **no
checkpoint**: a shell command's write set is unknown up front, so a mutating
command (`rm`, `git checkout --`) is not checkpoint-protected. Don't promise
otherwise in UI copy.

Restore is available from the UI (`checkpoint:list` / `checkpoint:restore`).
Checkpoint payloads are index-named (`entry_0000.json`) with the real relative
path inside, and binary files are stored base64 (`encoding: "base64"`).

## Models and providers

`src/lib/models.ts` is the single source of truth — the picker and the main
process resolver both import it. Never hardcode a model id anywhere else.

| Provider | Credential |
| --- | --- |
| `anthropic` | `pi auth login` (Claude Pro/Max OAuth or an API key) in `~/.pi/agent/auth.json` |
| `xai` | same |
| `nvidia` | `BEIDE_NVIDIA_API_KEY` in `.env` |
| `google` | `BEIDE_GOOGLE_API_KEY` in `.env` |

`readProviderStatus()` reports only `{ connected, kind }` per provider. beide
**never reads, copies, prints or logs token values** from `auth.json` — inspect
key names and types only. Keep it that way.

Resolution order when the requested model is unavailable: requested →
`DEFAULT_MODEL_ID` → `deepseek-ai/deepseek-v4-pro` → xAI fallback. Any fallback
emits a `beide:warning` event so the UI can say the pick was ignored; silent
snap-back reads as a bug.

Other emitted signals: `beide:model_fallback` (pi's own message) and
`beide:warning` for "no providers configured" and "model does not accept
images, they were dropped".

## Event stream

`session.subscribe` → `webContents.send("agent:event", event)`. The renderer
normalises a deliberately loose set of shapes in `useAgentStore.handleEvent`.
When adding an event type, extend that switch rather than reshaping events in
main — older shapes must keep working.

Accepted discriminators (any of `type` / `event` / `kind`, also nested under
`{ data: … }`):

| Event | Effect in the store |
| --- | --- |
| `text_delta`, `message_delta`, `delta`, `content_block_delta`, `assistant_delta` | append `delta` / `text` / `content` to the streaming assistant row |
| `text`, `message`, `assistant_message` | seed or append the full text |
| `message_start`, `assistant_start`, `turn_start` | ensure a streaming assistant row exists |
| `message_end`, `message_stop`, `assistant_end`, `turn_end`, `done`, `idle`, `agent_end` | finalise the row, `streaming = false` |
| `tool_start`, `tool_call`, `tool_use` | insert/update a tool card (`running`) |
| `tool_end`, `tool_result`, `tool_done` | update the tool card (`done` / `error`) |
| `error`, `agent_error` | surface the error and finalise |

The permission push carries:

```ts
{ id: string; kind: "write" | "edit" | "bash";
  path?: string; command?: string; diff?: string; content?: string;
  description: string }
```

The UI shows the diff modal and answers with
`agent.respondPermission(id, allow, content?)` — `content` lets the user edit
the payload before it is written.

Token deltas are batched (~30 ms) and workspace events debounced (~150 ms);
both are covered by `npm test`.

## Known runtime caveats

* `createAgentSession` has no `baseToolsOverride`; overriding by name through
  `customTools` is the supported trick.
* Auth must already exist in `~/.pi/agent/auth.json` — there is no login UI.
* `shell:run` is `cmd.exe /c` with a 30 s timeout, not a PTY. The terminal
  panel is a command runner, not a full shell (no `node-pty`, no xterm.js).
* Recursive `fs.watch` is best-effort on Windows.
* Long-running providers need generous HTTP timeouts — `undici`'s global
  dispatcher is configured once in `agent.ts` (60 s connect, 300 s body).
