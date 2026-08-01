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

The system prompt is `systemBase + project rules + project memory + workspace
tree snapshot`. Project rules come from `getRulesCandidates(cwd)` — `BEIDE.md`
and `.beide/rules.md` in the **user's** workspace, not this repo. Project
memory is `<workspace>/.beide/memory.md`, injected as "Project memory" when
non-empty (`loadProjectMemory` in `electron/services/agent.ts`).

The prompt itself carries an optional preamble, assembled in
`electron/services/agent.ts` from the payload built by
`electron/ipc.ts`'s `agent:prompt` handler: open-file context, then
`## Editor diagnostics (open tabs)` from `payload.diagnostics` (Monaco markers
collected by the renderer across open tabs), then
`## Codebase search results (@codebase)` from `payload.codebaseContext` —
resolved in the `agent:prompt` handler (not in `agent.ts`, to keep the agent
service decoupled from the workspace walker) by running
`WorkspaceService.searchContent()` per `@codebase` mention, lexical only,
capped at 24 000 chars total.

## `memory` tool

Available in both modes (it only appends). Given a one-line fact, it appends
`- <fact>` to `.beide/memory.md`, trimming the note to 500 chars. The file is
capped at ~8 000 chars: when a note pushes it over, the oldest lines are
dropped first — it is a working set, not an append-only log.

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

## Secret file masking

The `read` tool's file access is intercepted by `SECRET_FILE_RE` in
`electron/services/agent.ts`: `.env*`, `*.pem`, and any `*secrets*`/
`*credentials*` config (`.json`/`.yml`/`.yaml`/`.toml`/`.env`/`.txt`). A
matching path is still read, but `maskSecretValues()` blanks out `KEY=value`
and `"key": "value"` values (`***`) while leaving key names intact, and a
`beide:warning` is emitted so the UI can surface it. This only guards the
`read` tool's raw-filesystem path — it does not touch `bash`.

## Models and providers

`src/lib/models.ts` is the single source of truth — the picker and the main
process resolver both import it. Never hardcode a model id anywhere else.
Every entry carries a `vendor` (openai/anthropic/google/xai/zhipu/moonshot);
the picker groups by it in `VENDOR_ORDER`, and display names carry no gateway
branding (the settings screen shows the provider as "beide Cloud").

The only provider is `echogate` through its OpenAI-compatible
`https://api.echogate.one/v1` endpoint. The key normally arrives from
Supabase after sign-in: the renderer calls the
`get_encrypted_model_api_key()` RPC (authenticated only) and hands the
AES-256-GCM ciphertext to main over `agent:installProviderKey`;
`electron/services/provider-key.ts` decrypts it in memory. Publish or rotate
it with `npm run supabase:secrets`. `BEIDE_ECHOGATE_API_KEY` in local `.env`
is a dev override that wins over the cloud key. Provider status comes from
`ModelRuntime.getProviderAuthStatus()` and exposes only `{ connected, kind }`;
the key is installed as an in-memory runtime override and never reaches a
child shell.

The catalog mirrors the gateway's full `/v1/models` (33 entries across
OpenAI/Anthropic/Google/xAI/DeepSeek/Alibaba/Moonshot/Zhipu/MiniMax), with
real context windows, output caps and image support taken from that endpoint
(output capped at 131k so a runaway generation cannot eat a quota). Entries
the gateway lists but which currently error carry `disabled: true` — greyed
and unselectable in the picker (claude-opus-5, kimi-k3 as of 2026-08-01;
re-verify before re-enabling). When a saved model id is unavailable or
disabled, the picker falls back to `DEFAULT_MODEL_ID` (`gpt-5.6-terra`);
the runtime additionally emits a `beide:warning` for unavailable ids.

Other emitted signals: `beide:model_fallback` (pi's own message),
`beide:warning` for "no providers configured" and "model does not accept
images, they were dropped", and `beide:usage` with the provider-reported token
count of every finished assistant message — the renderer charges the account
with it (`spend_tokens`); the local estimate only pre-gates. pi's
`auto_retry_start` is surfaced in the chat as "provider not responding,
attempt N of M" (provider idle timeout 90 s, 2 retries).

## One-shot completions (`AgentService.complete`)

`complete()` is a non-agentic call straight to the gateway
(`/chat/completions`, `stream: false`) — no pi session, no tools, no history.
It reuses the same in-memory provider key as the agent. IPC: `ai:complete`.
Callers: inline Ctrl+K edits in Monaco (`src/components/editor/EditorArea.tsx`
+ `inline-edit.ts`), ghost-text autocompletion
(`src/components/editor/ghost-text.ts`), and git commit-message generation
(`GitPanel`). `probeGateway()` is a cheap reachability check (`agent:health`)
behind the status-bar "gateway unreachable" badge, polled every 90 s from the
renderer.

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
* `shell:run` (the agent's `bash` tool, also `window.beide.shell.run`) is
  still `cmd.exe /c` with a 30 s timeout, not a PTY — that is separate from
  the terminal panel, which now runs real PTY sessions (`terminal:*` IPC,
  see [UI.md](UI.md) and [KNOWN-GAPS.md](KNOWN-GAPS.md)).
* Recursive `fs.watch` is best-effort on Windows.
* Long-running providers need generous HTTP timeouts — `undici`'s global
  dispatcher is configured once in `agent.ts` (60 s connect, 300 s body).

## MCP servers

Users can plug external MCP servers into the agent via
`<workspace>/.beide/mcp.json`:

```json
{
  "servers": {
    "everything": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": { "SOME_KEY": "value" }
    }
  }
}
```

A missing or invalid file simply means no servers. Server names must match
`/^[a-z0-9_-]{1,32}$/i`; `command` is a non-empty string, `args` an array of
strings. `electron/services/mcp.ts` (`McpManager`, hand-rolled client — no SDK
dependency) spawns each server with `shell: false` over stdio
(newline-delimited JSON-RPC 2.0), does the MCP handshake
(`initialize` → `notifications/initialized` → `tools/list`, 15 s per request)
and kills/skips any server that fails it (console warning only). On Windows,
`shell: false` means `.cmd` shims are not directly spawnable — wrap them:
`"command": "cmd", "args": ["/c", "npx", "-y", "…"]`.

Each MCP tool is exposed to pi as a custom tool named
`mcp_<server>_<toolname>` (sanitized to `[a-z0-9_]`, `_2` suffix on
collision), available in **both** modes; results are the concatenated text
content items (`isError` throws back into the agent loop, 60 s call timeout).

Env hygiene: the child env is `stripSecretEnv(process.env)` plus the
server's own `env` block — provider keys and anything matching the secret
patterns never reach an MCP server. Servers are workspace-scoped: they start
lazily with the first session in a workspace, survive mode/model changes, and
are stopped on workspace switch and app shutdown.
