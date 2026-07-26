import { SubagentTool } from "beide"

const nested = [
  {
    type: "tool-Grep",
    toolCallId: "s1",
    state: "output-available",
    input: { pattern: "createCheckpoint" },
  },
  {
    type: "tool-Read",
    toolCallId: "s2",
    state: "output-available",
    input: { file_path: "electron/services/checkpoints.ts" },
  },
  {
    type: "tool-Read",
    toolCallId: "s3",
    state: "output-available",
    input: { file_path: "src/stores/editor.ts" },
  },
]

export function Complete() {
  return (
    <div className="w-96">
      <SubagentTool
        part={{
          type: "tool-Task",
          toolCallId: "sa1",
          state: "output-available",
          input: { description: "Trace how checkpoints reach the editor" },
          output: { totalDurationMs: 74000 },
        }}
        nestedTools={nested}
        chatStatus="ready"
      />
    </div>
  )
}

export function NoNestedTools() {
  return (
    <div className="w-96">
      <SubagentTool
        part={{
          type: "tool-Task",
          toolCallId: "sa2",
          state: "output-available",
          input: { description: "Summarise the release notes" },
          output: { totalDurationMs: 9000 },
        }}
        chatStatus="ready"
      />
    </div>
  )
}
