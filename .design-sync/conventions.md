# beide — how to build with this design system

`beide` is the component library behind an Electron-based coding IDE with an
embedded AI agent. It is a **dark-first, dense, keyboard-driven desktop UI** —
not a marketing site kit. Designs built with it should read as an application
chrome: tight spacing, small type, muted surfaces, one accent colour used
sparingly.

Everything below is what the components actually do, learned by rendering them.

## Getting the look right

- **Type scale is small.** `text-xs` and `text-sm` carry almost the whole UI;
  `text-base` is already a section heading. Tool rows, tab labels, status lines
  and metadata are all `text-xs`.
- **Colour comes from semantic tokens, never raw hex.** Use
  `bg-background` / `bg-card` / `bg-popover` / `bg-muted` for surfaces,
  `text-foreground` / `text-muted-foreground` for text, `border-border` for
  rules, and `text-primary` / `bg-accent` for the single accent. The agent-side
  components use a parallel `an-*` set (`bg-an-tool-background`,
  `text-an-foreground-muted`, `border-an-tool-border-color`) — match whichever
  family the surrounding component uses rather than mixing them.
- **Borders over shadows.** Panels are separated by 1px `border-border` and
  radius, not elevation. Shadows appear only on genuinely floating surfaces
  (toast, popover).
- **Fonts**: DM Sans for UI, JetBrains Mono for anything that is code, a path, a
  command, or a number in a diff. Both ship with the bundle — no font loading
  needed.

## Composition patterns

**Compound components (Base UI).** `Dialog`, `Sheet`, `Popover`, `Select`,
`DropdownMenu`, `ContextMenu`, `Command`, `Tabs`, `Collapsible`, `Tooltip` and
`Progress` are all trigger + portal + content sets. Always compose the full set
— a `DialogContent` without a `Dialog` root renders nothing. `Dialog`, `Sheet`
and `Popover` ship `*Header` / `*Footer` helpers; use them instead of hand-rolled
padding, they carry the border and spacing contract.

**Tooltips need a provider.** Wrap in `TooltipProvider` once, near the root.

**`Toast` needs a live toast manager** from Base UI (`ToastProvider` plus the
manager hook). It cannot be rendered as a static element.

## The agent surface

This is the distinctive half of the system — the components that render an AI
agent's work in a chat transcript.

**`ToolRowBase` is the primitive every tool row is built on.** One line: optional
icon, a label that shimmers while running and settles when done, a muted detail
string, optional trailing content (elapsed time), and an optional expandable
panel with a chevron. Pass `isAnimating` for the running state and
`shimmerLabel` / `completeLabel` as a present/past pair — "Reading" → "Read",
"Exploring" → "Explored".

**Tool components take an AI-SDK `part` object**, not loose props:

```jsx
<BashTool part={{
  type: "tool-Bash",
  toolCallId: "b1",
  state: "output-available",      // or "input-available" / "input-streaming"
  input: { command: "npm run build" },
  output: { stdout: "…", exitCode: 0 },
}} />
```

`state` drives the whole visual: `input-streaming` → skeleton/shimmer,
`input-available` → running, `output-available` → complete. Several components
also take `chatStatus` — a row only shows as *pending* when `chatStatus` is
`"streaming"`; otherwise an unfinished tool reads as *interrupted*.

**Card-shaped vs row-shaped.** `BashTool` and `EditTool` render bordered cards
(a terminal card and a syntax-highlighted unified diff). `SearchTool`,
`ThinkingTool`, `SubagentTool`, `McpTool` and `ToolGroup` render single rows that
expand. Mixing both in one transcript is the intended rhythm: rows for the
narration, cards where the user needs to read output.

**`ToolGroup` and `SubagentTool` nest.** Pass `nestedTools` an array of `part`
objects; each is looked up in the internal tool registry by its `type`
(`"tool-Read"`, `"tool-Grep"`, `"tool-Edit"`, …) and rendered as a `GenericTool`
row. While pending they stream in one at a time.

**Streaming feel comes from `TextShimmer`**, not spinners. Use it for any label
that is "in progress"; reserve `SpinnerIcon` / `IconSpinner` / `SpiralLoader` for
genuinely indeterminate waits.

**`QuestionPrompt`** renders the agent asking the user a question — single
choice, multi-select, or free text, with optional pagination across several
questions and a skip action. `QuestionTool` wraps it for the transcript and
shows the collapsed answer once given.

## Layout

`ActivityBar` is the far-left icon rail (files / search / settings, plus terminal
and agent toggles). `Resizer` is the drag gutter between panels — **transparent
at rest**, painting a 2px accent bar only on hover or drag. Both are app chrome:
use them when designing the shell, not inside a content pane.

## What not to reach for

- No raw `<button>` / `<input>` — use `Button`, `IconButton`, `Input`. The
  element reset is deliberately minimal and unstyled elements look broken.
- No custom spinner markup — `Spinner`, `IconSpinner`, `SpiralLoader` cover it.
- No hardcoded font stacks, colours, or radii. Every value has a token.
