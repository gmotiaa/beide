# beide v0.1 — MVP checklist

Matches success criteria from [`PRODUCT.md`](PRODUCT.md). Check off when verified manually on Windows.

## Launch

- [ ] `npm install` completes without errors
- [ ] `npm run dev` opens an Electron window titled **beide**
- [ ] `npm run typecheck` passes
- [ ] No blank crash on first paint (empty workspace OK)

## Workspace & editor

- [ ] Open folder → workspace root set
- [ ] File tree shows entries; expand directories
- [ ] Open file → tab + Monaco with sensible language
- [ ] Edit buffer → dirty indicator
- [ ] Ctrl+S saves to disk; dirty clears
- [ ] Filename search finds paths in workspace

## Agent (Grok / pi)

- [ ] Chat streams tokens from Grok via pi (`~/.pi/agent` auth)
- [ ] Abort stops an in-flight run
- [ ] Agent can **read** project files (tool-call visible)
- [ ] Agent can **edit/write** project files in Agent mode
- [ ] Errors from missing auth/model surface in UI (no silent hang)

## Plan vs Agent

- [ ] Mode toggle Plan | Agent in chat UI
- [ ] **Plan**: explores / plans, does **not** write files
- [ ] **Agent**: write/edit/bash available per permissions
- [ ] Default mode respects settings

## Permissions & diff

- [ ] `permissionMode: ask` → confirmation before write/edit/bash
- [ ] Diff preview shown for file mutations
- [ ] **Apply** writes; **Reject** skips
- [ ] `permissionMode: auto` applies without prompt

## Context

- [ ] Active file / open tabs influence context (soft attach)
- [ ] `@file` mention resolves and is sent with prompt
- [ ] Image paste/attach on prompt works
- [ ] `BEIDE.md` or `.beide/rules.md` picked up when present

## Checkpoints & sessions

- [ ] Checkpoint created before agent mutation
- [ ] Checkpoint list visible / restorable
- [ ] Restore reloads file contents in editor
- [ ] Session list / new / load per workspace under `.beide/sessions/`

## Settings, i18n, theme, terminal

- [ ] Language switch RU ↔ EN updates UI strings
- [ ] Theme switch: dark / light / midnight
- [ ] Settings persist across restart (userData JSON)
- [ ] Telemetry off by default; opt-in only
- [ ] Bottom terminal panel usable (shell or documented fallback)

## Non-goals (do not block MVP)

- macOS / Linux polish
- Extension marketplace
- Full LSP intelligence
- Advanced git GUI
- Multi-agent swarms
- Embeddings / cloud sync

## Sign-off

| Field | Value |
|-------|--------|
| Date | |
| Machine | Windows |
| Node | |
| Model | |
| Notes | |
