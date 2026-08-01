# beide

**beide** — desktop IDE с AI-агентом на базе [pi](https://github.com/earendil-works). Сделана в Беларуси. Ощущение как Cursor + VS Code, без лишнего.

Windows-first. Модели выбираются в чате и работают через EchoGate по ключу из локального `.env`.

---

## English (short)

**beide** is a Windows desktop IDE with a built-in AI coding agent (pi SDK). Made in Belarus. Open a folder, edit in Monaco, chat with the agent on the right — Plan mode for research, Agent mode for edits. Permissions default to ask-before-write.

**Requirements:** Node 22+, Windows, and `BEIDE_ECHOGATE_API_KEY` in local `.env`.

```bash
npm install
npm run dev
```

---

## Требования

| | |
|---|---|
| OS | Windows 10/11 |
| Node | **22+** (разработка велась на 24) |
| Auth | `BEIDE_ECHOGATE_API_KEY` в локальном `.env` |

Скопируйте [`.env.example`](.env.example) в `.env` и добавьте
`BEIDE_ECHOGATE_API_KEY`. Файл не попадает в репозиторий. Каталог моделей —
`src/lib/models.ts`.

## Быстрый старт

```bash
npm install
npm run dev
```

Сборка (без упаковки в installer):

```bash
npm run build
npm run preview
```

Проверка типов и тесты:

```bash
npm run typecheck
npm test
```

## Возможности v0.1

- Открытие папки (workspace), дерево файлов, поиск по имени
- Monaco-редактор: вкладки, подсветка, Ctrl+S, dirty-индикатор
- AI-чат справа со стримингом ответа и карточками tool-calls
- **Plan** / **Agent** режимы
- Permissions: **ask** (по умолчанию) или **auto**
- Diff preview → Apply / Reject перед записью файлов
- Checkpoints — откат правок агента
- `@file` / `@folder` в промпте, вложения картинок
- Темы: dark, light, midnight
- i18n: RU / EN
- Базовый терминал внизу
- Правила проекта: `BEIDE.md` или `.beide/rules.md`

## Plan vs Agent

| Режим | Что делает |
|-------|------------|
| **Plan** | Читает код, пишет план. **Не** меняет файлы. После Approve → можно уйти в Agent. |
| **Agent** | Полные tools: read / write / edit / bash. Уважает permission policy. |

Переключатель — в шапке чата.

## Permissions

В Settings:

- **ask** (default) — перед write / edit / bash показывается confirmation + diff
- **auto** — применять сразу (для тех, кто доверяет агенту в этом репо)

Перед мутацией beide снимает checkpoint в `.beide/checkpoints/`.

## Структура (кратко)

```
electron/     # main process: workspace, agent, permissions, checkpoints
src/          # React UI: editor, chat, sidebar, settings, terminal
docs/         # документация для разработчиков и агентов
specs/        # PRODUCT, ARCHITECTURE, MVP checklist (исторические брифы)
.beide/       # rules, sessions, checkpoints (локально, в gitignore)
```

Точка входа для разработчиков и AI-агентов — [`AGENTS.md`](AGENTS.md); оттуда
ссылки на [`docs/`](docs/): архитектура, IPC, чат и сессии, agent runtime, UI,
разработка, известные пробелы.

## Troubleshooting: агент не отвечает

Симптом: чат не стримит / `agent not ready` / ошибка модели.

1. Проверьте `BEIDE_ECHOGATE_API_KEY` в локальном `.env`.
2. Перезапустите `npm run dev` после смены `.env` — main process читает ключ при
   старте сессии.
3. Откройте папку (workspace): без неё сессии и чекпойнты недоступны.
4. Корп. proxy / firewall: Electron main ходит в EchoGate напрямую; нужен обычный HTTPS outbound.

beide **не** пишет ключ в репозиторий и не передаёт его дочерним shell-командам.

## Позиционирование

Первая белорусская IDE с полноценным AI-агентом в десктопе. Конкурсный + продуктовый проект. macOS/Linux, marketplace расширений и full LSP — вне scope v0.1.

## Лицензия

MIT
