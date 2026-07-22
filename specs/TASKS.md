# beide — Implementation Tasks (parallel agents)

## Shared rules for ALL agents
- Stack locked: Electron + electron-vite + React 18 + TS + Monaco + Zustand + i18next + xterm
- Package name: `beide`
- No placeholder TODOs that break runtime — stub with working empty states
- Types in `src/lib/types.ts` and mirror in electron as needed
- Russian comments only if necessary; code/identifiers in English
- Beautiful dark UI by default (zinc/neutral, accent blue-violet `#7C5CFF`)
- Do not commit secrets; read auth from `~/.pi/agent`

---

## TASK A — Scaffold & Electron shell
**Owns:** root config, electron main/preload bootstrap, IPC wiring stubs, README scripts  
**Files:**
- `package.json`, `tsconfig*.json`, `electron.vite.config.ts`, `index.html`
- `electron/main.ts`, `electron/preload.ts`, `electron/ipc.ts`
- `src/main.tsx`, `src/App.tsx`, `src/styles/global.css`
- `README.md`

**Must:**
- `npm run dev` starts Electron with React
- `window.beide` typed API exposed
- Window title "beide"
- Basic chrome layout regions (empty panels OK if other agents fill)

---

## TASK B — Workspace + Editor
**Owns:** file tree, monaco tabs, open/save, search files  
**Files:**
- `electron/services/workspace.ts`
- `src/components/sidebar/*`
- `src/components/editor/*`
- `src/stores/workspace.ts`, `src/stores/editor.ts`

**Must:**
- Open folder dialog
- Recursive tree (lazy expand OK)
- Open file → tab → Monaco with lang detection
- Ctrl+S save
- Unsaved dirty indicator
- Basic filename search

---

## TASK C — Agent service (pi SDK)
**Owns:** pi session lifecycle, streaming events, modes, permissions hook  
**Files:**
- `electron/services/agent.ts`
- `electron/services/permissions.ts`
- `electron/services/checkpoints.ts`
- `electron/services/sessions.ts`

**Must:**
- createAgentSession with cwd=workspace, agentDir=~/.pi/agent
- Default provider xai model grok-4.5
- prompt/abort/setMode
- Forward events to renderer
- ask/auto permission for write/edit
- checkpoint before mutations
- persist chat sessions under `.beide/sessions/`

---

## TASK D — Chat UI
**Owns:** right panel chat, streaming render, mentions, images, plan/agent toggle, diff modal  
**Files:**
- `src/components/chat/*`
- `src/components/diff/*`
- `src/stores/chat.ts`
- `src/stores/agent.ts`

**Must:**
- Message list with markdown + code fences
- Streaming token paint
- Tool-call cards (name, status, path)
- Mode toggle Plan | Agent
- Composer: text, @file autocomplete, image paste/attach
- Permission/diff modal Apply|Reject
- Abort button while streaming

---

## TASK E — Settings, themes, i18n, terminal
**Owns:** settings page/store, themes, translations, xterm panel  
**Files:**
- `electron/services/settings.ts`
- `src/components/settings/*`
- `src/components/terminal/*`
- `src/i18n/*`
- `src/styles/themes.css`
- `src/stores/settings.ts`

**Must:**
- Settings: language, theme, permissionMode, telemetry opt-in, model label
- Themes: dark, light, midnight
- i18n ru + en for all visible strings
- Bottom terminal panel (local shell via node-pty OR fallback simple cwd echo if pty hard on win — prefer node-pty)

---

## Integration order
1. A scaffold lands first (or simultaneously if paths don't clash)
2. B + C + E can parallel after A
3. D depends on C IPC shapes
4. Final glue: App.tsx layout composition
