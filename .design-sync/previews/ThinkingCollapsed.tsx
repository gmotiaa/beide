import { ThinkingCollapsed } from "beide"

const noop = () => {}

const step = {
  id: "thought",
  type: "tool-call" as const,
  toolName: "Thinking",
  toolDetail: "",
  duration: Number.MAX_SAFE_INTEGER,
  toolVariant: "thinking" as const,
  thoughtContent:
    "Checkpoints are written per turn, so restoring one has to roll back the editor buffers too — otherwise the tab bar keeps showing files the workspace no longer has.",
}

export function Collapsed() {
  return (
    <div className="w-96">
      <ThinkingCollapsed step={step} state="complete" onComplete={noop} />
    </div>
  )
}

export function Expanded() {
  return (
    <div className="w-96">
      <ThinkingCollapsed
        step={step}
        state="complete"
        onComplete={noop}
        defaultOpen
      />
    </div>
  )
}

export function Animating() {
  return (
    <div className="w-96">
      <ThinkingCollapsed
        step={{ ...step, id: "live", thoughtContent: "" }}
        state="animating"
        onComplete={noop}
      />
    </div>
  )
}
