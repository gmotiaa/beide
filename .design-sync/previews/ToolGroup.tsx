import { ToolGroup } from "beide"

const nested = [
  {
    type: "tool-Read",
    toolCallId: "n1",
    state: "output-available",
    input: { file_path: "src/stores/agent.ts" },
  },
  {
    type: "tool-Grep",
    toolCallId: "n2",
    state: "output-available",
    input: { pattern: "useAgentStore" },
  },
  {
    type: "tool-Edit",
    toolCallId: "n3",
    state: "output-available",
    input: { file_path: "src/components/chat/ChatPanel.tsx" },
  },
]

const part = {
  type: "tool-Task",
  toolCallId: "group",
  state: "output-available",
  input: { description: "Wire the chat panel to the agent store" },
  output: { totalDurationMs: 42000 },
}

export function Collapsed() {
  return (
    <div className="w-96">
      <ToolGroup
        part={part}
        nestedTools={nested}
        chatStatus="ready"
        completeLabel="Explored"
        shimmerLabel="Exploring"
        interruptedLabel="Exploration stopped"
      />
    </div>
  )
}

export function Expanded() {
  return (
    <div className="w-96">
      <ToolGroup
        part={part}
        nestedTools={nested}
        chatStatus="ready"
        completeLabel="Explored"
        shimmerLabel="Exploring"
        interruptedLabel="Exploration stopped"
        defaultOpen
      />
    </div>
  )
}

export function Interrupted() {
  return (
    <div className="w-96">
      <ToolGroup
        part={{ type: "tool-Task", toolCallId: "stopped", state: "input-available" }}
        nestedTools={[]}
        chatStatus="ready"
        completeLabel="Explored"
        interruptedLabel="Exploration stopped"
      />
    </div>
  )
}
