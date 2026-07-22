# beide

**beide** — desktop IDE с AI-агентом на базе [pi](https://github.com/earendil-works). Сделана в Беларуси. Ощущение как Cursor + VS Code, без лишнего.

Windows-first. Агент по умолчанию — xAI Grok через ваш локальный `~/.pi/agent`.

---

## English (short)

**beide** is a Windows desktop IDE with a built-in AI coding agent (pi SDK). Made in Belarus. Open a folder, edit in Monaco, chat with the agent on the right — Plan mode for research, Agent mode for edits. Permissions default to ask-before-write.

**Requirements:** Node 20+, Windows, pi auth for Grok (`~/.pi/agent`).

```bash
npm install
npm run dev
```

---

## Требования

| | |
|---|---|
| OS | Windows 10/11 |
| Node | **20+** |
| Auth | pi agent dir: `~/.pi/agent` с настроенным xAI / Grok |

Auth для Grok настраивается один раз через pi (см. [Troubleshooting](#troubleshooting-grok-auth)). beide не хранит API-ключи сам — читает то, что уже лежит в `~/.pi/agent`.

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

Проверка типов:

```bash
npm run typecheck
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
specs/        # PRODUCT, ARCHITECTURE, MVP checklist
.beide/       # rules, sessions, checkpoints (локально, в gitignore)
```

Подробнее: [`specs/PRODUCT.md`](specs/PRODUCT.md), [`specs/ARCHITECTURE.md`](specs/ARCHITECTURE.md).

## Troubleshooting: Grok auth

Симптом: чат не стримит / `agent not ready` / ошибка модели.

1. Убедитесь, что pi уже логинился в xAI:
   ```bash
   # типичный путь на Windows
   %USERPROFILE%\.pi\agent
   ```
   Там должны быть credentials / model config, которые понимает `@earendil-works/pi-coding-agent`.
2. Проверьте, что из CLI pi Grok отвечает (если pi установлен глобально).
3. Перезапустите `npm run dev` после смены auth — main process читает `agentDir` при старте сессии.
4. В Settings посмотрите label модели (по умолчанию xAI Grok; fallback — первая доступная).
5. Корп. proxy / firewall: Electron main ходит в API провайдера напрямую; нужен обычный HTTPS outbound.

beide **не** пишет ключи в репозиторий и **не** дублирует их в `userData` сверх того, что делает pi.

## Позиционирование

Первая белорусская IDE с полноценным AI-агентом в десктопе. Конкурсный + продуктовый проект. macOS/Linux, marketplace расширений и full LSP — вне scope v0.1.

## Лицензия

MIT
