import { ActivityBar } from "beide"

const noop = () => {}

export function Default() {
  return (
    <div className="flex h-72 overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <ActivityBar
        active="files"
        onChange={noop}
        terminalOpen={false}
        onToggleTerminal={noop}
        chatOpen
        onToggleChat={noop}
      />
      <div className="flex w-56 items-center justify-center bg-muted/30 text-xs text-muted-foreground">
        File tree
      </div>
    </div>
  )
}

export function Sections() {
  return (
    <div className="flex gap-6">
      {(["files", "search", "settings"] as const).map((id) => (
        <div
          key={id}
          className="flex flex-col items-center gap-2 overflow-hidden rounded-lg"
        >
          <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
            <ActivityBar
              active={id}
              onChange={noop}
              terminalOpen={false}
              onToggleTerminal={noop}
              chatOpen={false}
              onToggleChat={noop}
            />
          </div>
          <span className="text-xs text-muted-foreground">{id}</span>
        </div>
      ))}
    </div>
  )
}

export function PanelsOpen() {
  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <ActivityBar
            active="files"
            onChange={noop}
            terminalOpen={false}
            onToggleTerminal={noop}
            chatOpen={false}
            onToggleChat={noop}
          />
        </div>
        <span className="text-xs text-muted-foreground">panels closed</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <ActivityBar
            active="files"
            onChange={noop}
            terminalOpen
            onToggleTerminal={noop}
            chatOpen
            onToggleChat={noop}
          />
        </div>
        <span className="text-xs text-muted-foreground">terminal + agent</span>
      </div>
    </div>
  )
}
