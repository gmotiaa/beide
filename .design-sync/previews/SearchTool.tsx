import { SearchTool } from "beide"

export function CodeSearch() {
  return (
    <div className="w-96">
      <SearchTool
        part={{
          type: "tool-Grep",
          toolCallId: "s1",
          state: "output-available",
          input: { pattern: "useAgentStore" },
          output: { matches: 12 },
        }}
      />
    </div>
  )
}

export function WebSearch() {
  return (
    <div className="w-96">
      <SearchTool
        part={{
          type: "tool-WebSearch",
          toolCallId: "s2",
          state: "output-available",
          input: { query: "electron ipc contextBridge best practices" },
        }}
        results={[
          {
            source: "web",
            title: "Context Isolation — Electron docs",
            date: "2025-11-04",
          },
          {
            source: "web",
            title: "Securing preload scripts",
            date: "2025-08-19",
          },
        ]}
        defaultOpen
      />
    </div>
  )
}

export function Searching() {
  return (
    <div className="w-96">
      <SearchTool
        part={{
          type: "tool-Glob",
          toolCallId: "s3",
          state: "input-available",
          input: { pattern: "src/**/*.tsx" },
        }}
      />
    </div>
  )
}
