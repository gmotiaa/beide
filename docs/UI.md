# UI, theming and i18n

React 19 + Tailwind v4 + shadcn primitives + a vendored Agent Elements registry
for the chat surface. No component library beyond those — do not introduce a
second one (HeroUI, MUI, Chakra…).

## Layout

```
┌ TitleBar (custom chrome, --title-h) ─────────────────────────────┐
│ ActivityBar │ Sidebar        │ Editor (Monaco) + TabBar │ Chat   │
│             │ FileTree /     │ TerminalPanel (toggle)   │ Panel  │
│             │ SearchPanel    │                          │        │
├ StatusBar (--status-h) ──────────────────────────────────────────┤
```

`AppLayout` owns the grid; panes are resized by `common/Resizer`. Shell styling
lives in `src/styles/shell.css`; the chat panel's height chain there is
load-bearing — the transcript scrolls inside a flex column with `min-height: 0`
at every level. Breaking one link makes the message list clip instead of
scroll.

## Design tokens

`src/styles/themes.css` is the palette. Three themes — `light` ("mineral"),
`dark`, `midnight` — selected by `:root[data-theme="…"]`. Everything derived
(shadows, fields, scrollbars, chat colours) resolves from the palette block, so
**a new theme only overrides the palette**.

`src/styles/global.css` maps those tokens onto:

* shadcn semantic tokens via `@theme inline` (`--color-background`,
  `--color-primary`, …). Note `--color-primary-foreground` → `--accent-contrast`
  because the accent is light in dark themes.
* Agent Elements tokens (`--an-*`) in
  `src/components/agent-elements/agent-ui.css`.

Never hardcode a hex value in a component. Add or reuse a token.

Each palette also answers to `[data-palette="light|dark|midnight"]` on any
element, so a subtree can paint itself in a theme the app is not wearing — the
onboarding theme swatches are miniature IDEs built that way. Only the palette
is scoped: the derived tokens (`--accent-muted`, `--shadow`, `--focus-ring`, …)
are computed on `:root` and inherited, so a preview sticks to `--bg`, `--panel`,
`--border`, `--text` and `--accent`.

## Agent Elements

`src/components/agent-elements/` is vendored from
`https://agent-elements.21st.dev` (registry entries also declared in
`components.json`). The code is ours now — edit the files directly instead of
wrapping them.

Key pieces:

| File | Role |
| --- | --- |
| `message-list.tsx` | groups messages into turns, hides the last assistant block while planning |
| `input-bar.tsx` (+ `input/`) | composer, attachments, mode selector, model picker, suggestions |
| `tools/tool-registry.ts` | per-tool icon + label + summary, keyed `tool-<Name>` |
| `tools/*.tsx` | the cards (bash, edit, search, todo, plan, thinking, mcp, subagent, generic) |
| `utils/tool-part-normalizer.ts` | pi/AI-SDK tool part → renderable shape |
| `markdown.tsx` | streaming-safe markdown (`streamdown` + `@streamdown/code`) |

`src/lib/to-ui-messages.ts` converts `ChatMessage[]` (our store shape) into the
`UIMessage[]` shape Agent Elements expects. If a message stops rendering, check
that converter before suspecting the list.

Unknown tools fall back to `GenericTool` — adding a tool card means adding an
entry to `tool-registry.ts`, not a special case in the list.

## Keyboard shortcuts

Registered globally in `AppLayout` (`Ctrl` on Windows, `Cmd` on macOS):

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd+S` | save the active tab |
| `Ctrl/Cmd+O` | open a workspace folder (same picker as the title-bar menu) |
| `Ctrl/Cmd+L` | open the chat panel and focus `#chat-composer` |
| `Ctrl/Cmd+B` | toggle the sidebar |
| ``Ctrl/Cmd+` `` | toggle the terminal |

The activity-bar tooltips spell out the shortcut they duplicate, and the status
bar exposes the same two actions as chips: the workspace item opens a folder,
the mode item flips `plan` ⇄ `agent`.

Inside the terminal input, `Ctrl/Cmd+L` clears the log instead; `↑`/`↓` walk the
command history. In the composer, `Enter` sends and `Shift+Enter` inserts a
newline.

`workspace:changed` (optional `{ path? }`) refreshes the file tree and reloads
open tabs for that path **only when they are not dirty** — never clobber unsaved
edits.

## i18n

`react-i18next`, resources in `src/i18n/{ru,en}.json`, default language `ru`,
fallback `en`. Every user-visible string goes through a key in **both** files.
Language switches through `setAppLanguage()` (also sets `<html lang>`), driven
by `BeideSettings.language`.

Warning strings emitted by the main process (`beide:warning`) are currently
Russian literals in `electron/services/agent.ts` — if you touch them, keep them
readable for a Russian-speaking user or move them behind keys.

## Icons

`@tabler/icons-react` in Agent Elements, `lucide-react` for shadcn primitives
(`components.json` → `iconLibrary: lucide`). Pick the one already used by the
folder you are editing.

## Adding a shadcn component

```bash
npx shadcn@latest add <name>          # lands in src/components/ui/
npx shadcn@latest add @agent-elements/<name>
```

Only keep what is imported — unused primitives were removed once already.
