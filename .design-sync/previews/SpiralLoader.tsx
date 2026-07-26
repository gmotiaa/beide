import { SpiralLoader } from "beide"

export function Default() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <SpiralLoader />
      <span>Default — 16px, inherits the current colour.</span>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex items-end gap-5 text-foreground">
      <SpiralLoader size={12} />
      <SpiralLoader size={16} />
      <SpiralLoader size={24} />
      <SpiralLoader size={40} />
    </div>
  )
}

export function InContext() {
  return (
    <div className="flex w-80 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <SpiralLoader size={14} className="text-primary" />
      <span className="text-sm text-muted-foreground">
        Starting the agent session…
      </span>
    </div>
  )
}
