import { BashToolTerminalCard } from "beide"

const noop = () => {}

function step(overrides = {}) {
  return {
    id: "bash",
    type: "tool-call" as const,
    toolName: "Bash",
    toolDetail: "npm run build",
    duration: Number.MAX_SAFE_INTEGER,
    bashCommand: "npm run build",
    ...overrides,
  }
}

export function Ran() {
  return (
    <div className="w-[28rem]">
      <BashToolTerminalCard
        step={step({
          bashOutput: "vite v6.0.7 building for production...\n✓ 412 modules transformed.\ndist/index.html  0.61 kB",
          bashSuccess: true,
        })}
        state="complete"
        onComplete={noop}
      />
    </div>
  )
}

export function Running() {
  return (
    <div className="w-[28rem]">
      <BashToolTerminalCard
        step={step({ bashCommand: "git status --porcelain | head -20" })}
        state="animating"
        onComplete={noop}
      />
    </div>
  )
}

export function NoOutput() {
  return (
    <div className="w-[28rem]">
      <BashToolTerminalCard
        step={step({ bashCommand: "mkdir -p .design-sync/previews" })}
        state="complete"
        onComplete={noop}
      />
    </div>
  )
}
