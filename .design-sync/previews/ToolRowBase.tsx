import { ToolRowBase } from "beide"

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  )
}

export function Complete() {
  return (
    <div className="w-96">
      <ToolRowBase
        icon={<FileIcon />}
        completeLabel="Read"
        detail="src/stores/agent.ts"
        isAnimating={false}
      />
    </div>
  )
}

export function Running() {
  return (
    <div className="w-96">
      <ToolRowBase
        icon={<FileIcon />}
        shimmerLabel="Reading"
        completeLabel="Read"
        detail="src/stores/agent.ts"
        isAnimating
      />
    </div>
  )
}

export function WithTrailingContent() {
  return (
    <div className="w-96">
      <ToolRowBase
        icon={<FileIcon />}
        completeLabel="Explored"
        detail="12 files"
        isAnimating={false}
        trailingContent={
          <span className="font-normal tabular-nums shrink-0 text-an-foreground-muted/60">
            8s
          </span>
        }
      />
    </div>
  )
}

export function Expanded() {
  return (
    <div className="w-96">
      <ToolRowBase
        icon={<FileIcon />}
        completeLabel="Thought"
        isAnimating={false}
        expandable
        defaultOpen
      >
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          The chevron rotates to 90° while the panel is open, and the panel
          height animates from the collapsible CSS variable.
        </p>
      </ToolRowBase>
    </div>
  )
}
