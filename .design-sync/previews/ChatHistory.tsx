import { ChatHistory } from "beide"

// ChatHistory is a self-contained control: it owns its trigger button and the
// session Sheet behind it. The Sheet only opens on click, so a static preview
// shows the trigger in the surface it actually lives on.
export function InPanelHeader() {
  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">Агент</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <ChatHistory />
        </div>
      </div>
      <div className="px-3 py-4 text-sm text-muted-foreground">
        The history button sits at the right edge of the chat panel header;
        pressing it slides the session Sheet in from the right.
      </div>
    </div>
  )
}

export function Trigger() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <ChatHistory />
      <span>
        Ghost icon-sm button with a tooltip — «История чатов» — and no props of
        its own; sessions come from the chat store.
      </span>
    </div>
  )
}
