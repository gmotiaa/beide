import { ThinkingTool } from "beide"

const THOUGHT = `The panel width is driven by a resizer, so the diff card has to
survive a narrow container. Unified diff style keeps it readable down to about
360px; below that the line numbers should drop out rather than wrap.`

export function Thought() {
  return (
    <div className="w-96">
      <ThinkingTool
        part={{
          type: "tool-Thinking",
          toolCallId: "th1",
          state: "output-available",
          input: { thought: THOUGHT },
        }}
      />
    </div>
  )
}

export function Expanded() {
  return (
    <div className="w-96">
      <ThinkingTool
        part={{
          type: "tool-Thinking",
          toolCallId: "th2",
          state: "output-available",
          input: { thought: THOUGHT },
        }}
        defaultOpen
      />
    </div>
  )
}

export function Thinking() {
  return (
    <div className="w-96">
      <ThinkingTool
        part={{
          type: "tool-Thinking",
          toolCallId: "th3",
          state: "input-streaming",
          input: { thought: "" },
        }}
      />
    </div>
  )
}
