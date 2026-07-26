import { InputPopover } from "beide"
import type { ReactNode } from "react"

// The popup renders through a portal, so the story root needs its own box to
// measure — and enough room above the trigger for side="top" to land inside.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex h-64 w-full items-end justify-center rounded-lg border border-border/60 bg-background p-4">
      {children}
    </div>
  )
}

function Row({ label, hint }: { label: string; hint?: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-an-foreground hover:bg-muted"
    >
      <span className="flex-1 truncate">{label}</span>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </button>
  )
}

export function Open() {
  return (
    <Stage>
      <InputPopover
        open
        side="top"
        align="start"
        trigger={
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
          >
            Model
          </button>
        }
      >
        <Row label="Claude Opus 5" hint="⌘1" />
        <Row label="Claude Sonnet 5" hint="⌘2" />
        <Row label="Claude Haiku 4.5" hint="⌘3" />
      </InputPopover>
    </Stage>
  )
}

export function Trigger() {
  return (
    <div className="flex items-center gap-2">
      <InputPopover
        trigger={
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
          >
            Mode
          </button>
        }
      >
        <Row label="Plan" />
        <Row label="Accept edits" />
      </InputPopover>
      <span className="text-xs text-muted-foreground">
        closed — the trigger must be a single native button
      </span>
    </div>
  )
}
