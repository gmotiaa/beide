# beide — Architecture (v0.1)

## Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer (React)                                            │
│  Layout: ActivityBar | Sidebar(FileTree) | Editor | Chat   │
│  Monaco tabs · xterm · Settings · DiffModal · CommandPalette│
└──────────────┬────────────────────────────▲─────────────────┘
               │ contextBridge IPC           │ events stream
┌──────────────▼────────────────────────────┴─────────────────┐
│ Preload (thin typed API: window.beide.*)                    │
└──────────────┬────────────────────────────▲─────────────────┘
               │ ipcMain                     │ webContents.send
┌──────────────▼────────────────────────────┴─────────────────┐
│ Main (Electron)                                             │
│  · WorkspaceService (fs, watch, search)                     │
│  · AgentService (pi createAgentSession)                     │
│  · PermissionGateway (ask/auto, diff buffers)               │
│  · CheckpointService (pre-edit snapshots)                   │
│  · SettingsStore (JSON in userData)                         │
│  · SessionStore (chat transcripts per workspace)            │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
     ~/.pi/agent (auth, models) + workspace cwd
```

## Process model
- **Main** owns filesystem + agent (Node-native pi SDK).
- **Renderer** is pure UI; no direct fs/agent.
- All agent events forwarded as `agent:event` IPC.

## IPC contract (summary)

### Invokes (request/response)
- `workspace:open` → `{ rootPath }`
- `workspace:readDir` / `workspace:readFile` / `workspace:writeFile`
- `workspace:search` → files by name
- `agent:prompt` → `{ text, mode, mentions[], images[] }`
- `agent:abort`
- `agent:setMode` → `plan | agent`
- `agent:respondPermission` → `{ id, allow, content? }`
- `checkpoint:list` / `checkpoint:restore`
- `settings:get` / `settings:set`
- `session:list` / `session:load` / `session:new`

### Events (main → renderer)
- `agent:event` — pi session events (text_delta, tool start/end, message end, errors)
- `agent:permission` — needs user approval `{ id, kind, path?, diff?, command? }`
- `workspace:changed` — fs watch

## Agent integration
```ts
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";
```
- `cwd` = workspace root
- `agentDir` = `~/.pi/agent` (reuse user auth for Grok)
- Default model: xai / grok-4.5 (fallback: first available)
- Tools plan: `["read", "bash"]` (bash used carefully; system prompt says no destructive writes)
- Tools agent: `["read", "write", "edit", "bash"]`
- Permission: intercept before apply via custom tool wrappers OR post-event gate in AgentService when settings.permissionMode === 'ask'

### Permission strategy (v0.1)
Wrap write/edit in AgentService:
1. Before applying file mutation → CheckpointService.snapshot(paths)
2. If ask → pause, send `agent:permission` with diff, wait for respond
3. If allow → apply; if deny → skip / tell agent

## Checkpoints
- Dir: `{workspace}/.beide/checkpoints/{timestamp}/`
- Store changed file contents before agent write
- Restore copies back + notify renderer to reload buffers
- `.beide/` in effective gitignore suggestion

## Project layout
```
beide/
  package.json
  electron.vite.config.ts
  electron/
    main.ts
    preload.ts
    services/
      workspace.ts
      agent.ts
      permissions.ts
      checkpoints.ts
      settings.ts
      sessions.ts
    ipc.ts
  src/
    main.tsx
    App.tsx
    styles/
    i18n/
    stores/
    components/
      layout/
      sidebar/
      editor/
      chat/
      diff/
      settings/
      terminal/
      common/
    lib/
      ipc.ts
      types.ts
  specs/
  README.md
```

## UI layout (Cursor-like)
- Left activity bar (files, search, settings)
- Sidebar file tree
- Center: editor tabs + monaco + bottom panel (terminal)
- Right: AI chat (resizable), mode toggle Plan|Agent
- Top bar: window title, workspace name

## i18n keys
- Namespace: `common`, `chat`, `settings`, `editor`
- Languages: `ru`, `en` (default OS or ru)

## Packaging (later)
- electron-builder → NSIS Windows installer
- Not required for v0.1 dev run
