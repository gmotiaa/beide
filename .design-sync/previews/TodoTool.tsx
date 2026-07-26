import { TodoTool } from "beide"

const todos = [
  { content: "Wire the agent store to the IPC bridge", status: "completed" },
  { content: "Stream tool parts into the chat panel", status: "completed" },
  { content: "Render the diff card for Edit and Write", status: "in_progress" },
  { content: "Persist checkpoints between sessions", status: "pending" },
  { content: "Add usage accounting to the status bar", status: "pending" },
]

export function List() {
  return (
    <div className="w-96">
      <TodoTool
        part={{
          type: "tool-TodoWrite",
          toolCallId: "t1",
          state: "output-available",
          input: { todos },
        }}
        chatStatus="ready"
      />
    </div>
  )
}

export function Pending() {
  return (
    <div className="w-96">
      <TodoTool
        part={{
          type: "tool-TodoWrite",
          toolCallId: "t2",
          state: "input-available",
          input: { todos },
        }}
        chatStatus="streaming"
      />
    </div>
  )
}

export function Streaming() {
  return (
    <div className="w-96">
      <TodoTool
        part={{
          type: "tool-TodoWrite",
          toolCallId: "t3",
          state: "input-streaming",
          input: {},
        }}
        chatStatus="streaming"
      />
    </div>
  )
}
