import { SearchGroupRich } from "beide"

const noop = () => {}

const toolSteps = [
  {
    id: "q1",
    type: "tool-call" as const,
    toolName: "WebSearch",
    toolDetail: "tailwind v4 layer precedence",
    duration: Number.MAX_SAFE_INTEGER,
    toolVariant: "search" as const,
    searchQuery: "tailwind v4 layer precedence",
    searchSource: "web",
  },
  {
    id: "q2",
    type: "tool-call" as const,
    toolName: "WebSearch",
    toolDetail: "unlayered css beats @layer",
    duration: Number.MAX_SAFE_INTEGER,
    toolVariant: "search" as const,
    searchQuery: "unlayered css beats @layer",
    searchSource: "web",
  },
]

const stepStates = { q1: "complete" as const, q2: "complete" as const }

const results = [
  {
    source: "web",
    title: "Cascade layers — Tailwind CSS v4 upgrade guide",
    date: "2025-09-30",
  },
  {
    source: "web",
    title: "@layer and specificity, explained",
    date: "2025-06-12",
  },
  { source: "web", title: "Why my reset wins everywhere", date: "2025-02-01" },
]

export function Collapsed() {
  return (
    <div className="w-96">
      <SearchGroupRich
        toolSteps={toolSteps}
        stepStates={stepStates}
        onStepComplete={noop}
        results={results}
      />
    </div>
  )
}

export function Expanded() {
  return (
    <div className="w-96">
      <SearchGroupRich
        toolSteps={toolSteps}
        stepStates={stepStates}
        onStepComplete={noop}
        results={results}
        defaultOpen
      />
    </div>
  )
}
