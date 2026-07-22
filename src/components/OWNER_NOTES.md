# UI owner notes

## Missing dependency
- Terminal panel currently uses `window.beide.shell.run` (simple command runner UI).
- `package.json` lists `@xterm/addon-fit` and `@xterm/addon-web-links` but **not** `@xterm/xterm` (or `xterm`).
- To upgrade to a full xterm.js surface, add: `"@xterm/xterm": "^5.5.0"` (or matching addon major).

## Event handling assumptions (`agent:event`)
Main may emit flexible shapes. Renderer normalizes via `useAgentStore.handleEvent`:

| Accepted `type` / `event` / `kind` | Behavior |
|------------------------------------|----------|
| `text_delta`, `message_delta`, `delta`, `content_block_delta`, `assistant_delta` | Append `delta` / `text` / `content` to streaming assistant bubble |
| `text`, `message`, `assistant_message` | Seed or append full text |
| `message_start`, `assistant_start`, `turn_start` | Ensure streaming assistant message |
| `message_end`, `message_stop`, `assistant_end`, `turn_end`, `done`, `idle`, `agent_end` | Finalize assistant, `streaming=false` |
| `tool_start`, `tool_call`, `tool_use` | Insert/update tool card (`running`) |
| `tool_end`, `tool_result`, `tool_done` | Update tool card (`done` / `error`) |
| `error`, `agent_error` | Show error, finalize |
| Nested `{ data: { type, delta, ... } }` | Also accepted |

## Permission (`agent:permission`)
Payload expected:
```ts
{ id: string; kind: "write"|"edit"|"bash"; path?: string; command?: string; diff?: string; content?: string; description: string }
```
UI shows DiffModal → `agent.respondPermission(id, allow, content?)`.

## workspace:changed
Optional `{ path?: string }`. Reloads non-dirty open tabs for that path and refreshes tree.

## Keyboard
- `Ctrl/Cmd+S` — save active tab
- `Ctrl/Cmd+L` — focus chat composer
- `Ctrl/Cmd+B` — toggle sidebar
- `Ctrl/Cmd+\`` — toggle terminal
