import { GenericToolRow } from "beide"

const noop = () => {}

function step(overrides = {}) {
  return {
    id: "row",
    type: "tool-call" as const,
    toolName: "Read",
    toolDetail: "agent.ts",
    duration: Number.MAX_SAFE_INTEGER,
    ...overrides,
  }
}

export function Complete() {
  return (
    <div className="w-96">
      <GenericToolRow step={step()} state="complete" onComplete={noop} />
    </div>
  )
}

export function Running() {
  return (
    <div className="w-96">
      <GenericToolRow step={step()} state="animating" onComplete={noop} />
    </div>
  )
}

export function VariedTools() {
  return (
    <div className="flex w-96 flex-col gap-2">
      <GenericToolRow
        step={step({ id: "a", toolName: "Grep", toolDetail: "useAgentStore" })}
        state="complete"
        onComplete={noop}
      />
      <GenericToolRow
        step={step({ id: "b", toolName: "Glob", toolDetail: "src/**/*.tsx" })}
        state="complete"
        onComplete={noop}
      />
      <GenericToolRow
        step={step({ id: "c", toolName: "Write", toolDetail: "settings.ts" })}
        state="complete"
        onComplete={noop}
      />
    </div>
  )
}
