import { Resizer } from "beide"

const noop = () => {}

function Pane({ title, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center bg-muted/40 text-xs text-muted-foreground ${className}`}
    >
      {title}
    </div>
  )
}

export function VerticalGutter() {
  return (
    <div className="flex h-40 w-80 overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Pane title="File tree" className="w-1/3" />
      <Resizer direction="vertical" onResize={noop} />
      <Pane title="Editor" className="flex-1" />
    </div>
  )
}

export function HorizontalGutter() {
  return (
    <div className="flex h-40 w-80 flex-col overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <Pane title="Editor" className="flex-1" />
      <Resizer direction="horizontal" onResize={noop} />
      <Pane title="Terminal" className="h-1/3" />
    </div>
  )
}

export function DraggingAppearance() {
  return (
    <div className="flex flex-col gap-2">
      <div className="[&_.resizer::after]:bg-accent [&_.resizer::after]:opacity-70 flex h-40 w-80 overflow-hidden rounded-lg ring-1 ring-foreground/10">
        <Pane title="File tree" className="w-1/3" />
        <Resizer direction="vertical" onResize={noop} />
        <Pane title="Editor" className="flex-1" />
      </div>
      <p className="w-80 text-xs text-muted-foreground">
        The gutter is transparent at rest — a 4px hit area with a 2px accent
        bar that only paints on hover or while dragging. This cell forces that
        painted state so it is visible in a still.
      </p>
    </div>
  )
}
