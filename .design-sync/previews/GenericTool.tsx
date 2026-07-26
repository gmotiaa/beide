import { GenericTool } from "beide"

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function States() {
  return (
    <div className="flex w-96 flex-col gap-2">
      <GenericTool
        icon={SearchIcon}
        title="Searched"
        subtitle="useAgentStore"
        isPending={false}
      />
      <GenericTool
        icon={SearchIcon}
        title="Searching"
        subtitle="useAgentStore"
        isPending
      />
      <GenericTool
        icon={SearchIcon}
        title="Search failed"
        subtitle="no matches"
        isPending={false}
        isError
      />
    </div>
  )
}

export function WithoutSubtitle() {
  return (
    <div className="w-96">
      <GenericTool icon={SearchIcon} title="Listed workspace" isPending={false} />
    </div>
  )
}
