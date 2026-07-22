# Electron main — owner notes

## pi SDK integration approach

- Session created via `createAgentSession` from `@earendil-works/pi-coding-agent`.
- `agentDir` = `~/.pi/agent` (reuses user auth / models.json).
- `cwd` = workspace root; no session until a folder is open.
- Model: prefer `xai/grok-4.5`, then other xai ids, else first `ModelRuntime.getAvailable()`.
- System prompt via `DefaultResourceLoader({ systemPromptOverride, noExtensions: true })`.
- Plan tools: `read`, `bash` (bash ops block obvious mutators).
- Agent tools: `read`, `bash`, `edit`, `write`.
- **Permissions:** custom tool definitions (`createWriteToolDefinition` / `createEditToolDefinition` / `createBashToolDefinition`) with pluggable `operations` that:
  1. snapshot via CheckpointService
  2. call PermissionGateway (ask → `agent:permission` IPC + promise; auto → allow)
  3. apply or throw deny
- Custom tools share builtin names and override them in the session tool registry.
- Events: `session.subscribe` → `webContents.send('agent:event', event)`.
- Images: mapped to pi `ImageContent` `{ type:'image', data, mimeType }`.
- Mentions: preamble + file body injection before `session.prompt`.

## API gaps / caveats

1. `createAgentSession` does not expose `baseToolsOverride`; overriding via `customTools` with the same names works (confirmed in agent-session tool registry merge).
2. Mode switch tears down and lazily recreates the session (tool allowlist + system prompt). In-memory pi transcript is not carried across modes in v0.1 — chat UI should keep messages via SessionService / renderer store.
3. Auth must already exist in `~/.pi/agent/auth.json` (run `pi` CLI login). We do not ship a login UI yet.
4. `shell:run` is `cmd.exe /c` (Windows) with 30s timeout — not a full PTY; terminal UI may later add `node-pty` (not in package.json).
5. Recursive `fs.watch` is best-effort on Windows.
6. Package must be installed (`npm install`) so Electron main can resolve `@earendil-works/pi-coding-agent`.

## IPC channels

See `src/lib/types.ts` `BeideApi` and `electron/preload.ts`.
