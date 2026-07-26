import { TextShimmer } from "beide"

export function ThinkingLine() {
  return (
    <div className="flex w-72 flex-col gap-3 text-sm">
      <TextShimmer>Thinking…</TextShimmer>
      <TextShimmer>Reading src/stores/agent.ts</TextShimmer>
      <TextShimmer>Running the test suite</TextShimmer>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex w-80 flex-col gap-3">
      <TextShimmer className="text-xs">Small — status line</TextShimmer>
      <TextShimmer className="text-sm">Default — message body</TextShimmer>
      <TextShimmer className="text-base font-medium">
        Large — section heading
      </TextShimmer>
    </div>
  )
}

export function Timing() {
  return (
    <div className="flex w-72 flex-col gap-3 text-sm">
      <TextShimmer duration={1}>Fast sweep — duration 1s</TextShimmer>
      <TextShimmer duration={2}>Default sweep — duration 2s</TextShimmer>
      <TextShimmer duration={4} spread={160}>
        Slow, wide sweep — duration 4s, spread 160
      </TextShimmer>
    </div>
  )
}
