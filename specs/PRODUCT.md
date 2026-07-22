# beide — Product Spec (v0.1 MVP)

## One-liner
**beide** — desktop IDE с AI-агентом (на базе pi), сделанная в Беларуси. Ощущение как Cursor + VS Code.

## Goals
- Конкурсный + продуктовый проект
- Windows-first desktop app
- Рабочий AI agent (Grok / xAI first)
- RU/EN i18n, сменные темы
- «Первая белорусская IDE с агентом» как позиционирование

## Non-goals (v0.1)
- macOS/Linux polish
- Extension marketplace
- Full LSP language intelligence
- Advanced git GUI (commit graph, rebase)
- Multi-agent swarms UI
- Embeddings / vector codebase index
- Cloud sync / accounts

## Primary flow
1. Пользователь открывает папку (workspace)
2. Редактирует код в Monaco (tabs, tree, search)
3. Справа — чат с агентом (Plan mode / Agent mode)
4. Агент стримит ответ, показывает tool-calls
5. Правки: diff preview → Apply / Reject (или auto, если выбрано в settings)
6. Checkpoints позволяют откатить агентские правки

## Modes
| Mode | Behavior |
|------|----------|
| **Plan** | Агент исследует код, пишет план, **не** пишет файлы (tools: read, bash readonly-ish). Пользователь Approve → переключение в Agent. |
| **Agent** | Полные tools: read/write/edit/bash. Уважает permission policy. |

## Permissions (settings)
- `ask` (default) — перед write/edit/bash показывать confirmation + diff
- `auto` — применять сразу (power user)
- later: allowlist команд

## Context
- Open tabs + active file auto-attached as soft context
- `@file`, `@folder` mentions in prompt
- Image attachments on prompt
- Project rules file: `BEIDE.md` or `.beide/rules.md` if present
- Session history per workspace

## Tech choices (locked for v0.1)
- **Shell:** Electron + Vite + React + TypeScript
- **Editor:** Monaco
- **Terminal:** xterm.js (basic)
- **Agent:** `@earendil-works/pi-coding-agent` SDK in Electron main process
- **Default model:** xAI Grok (reuse `~/.pi/agent` auth if present)
- **State:** Zustand
- **i18n:** i18next (ru/en)
- **Themes:** dark (default), light, beide-midnight
- **Telemetry:** optional anonymous (app version, OS, feature flags) — off by default

## Success criteria (v0.1 "works")
- [ ] `npm install && npm run dev` launches window
- [ ] Open folder → see file tree → open/edit/save files
- [ ] Chat streams from Grok via pi
- [ ] Agent can read and edit project files
- [ ] Diff preview + apply/reject in `ask` mode
- [ ] Plan vs Agent mode toggle
- [ ] @file mention + image attach
- [ ] Theme + language switch
- [ ] Basic checkpoint restore
