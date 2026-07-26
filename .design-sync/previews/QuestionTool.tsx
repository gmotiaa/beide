import { QuestionTool } from "beide"

const questions = [
  {
    kind: "single" as const,
    title: "Which model should the new session use?",
    options: [
      { id: "opus", label: "Opus", description: "Deepest reasoning." },
      { id: "sonnet", label: "Sonnet", description: "Balanced." },
      { id: "haiku", label: "Haiku", description: "Fastest." },
    ],
  },
]

export function Asking() {
  return (
    <div className="w-[28rem]">
      <QuestionTool
        part={{
          type: "tool-AskUserQuestion",
          toolCallId: "q1",
          state: "input-available",
          input: { questions, allowSkip: true },
        }}
        chatStatus="streaming"
      />
    </div>
  )
}

export function Answered() {
  return (
    <div className="w-[28rem]">
      <QuestionTool
        part={{
          type: "tool-AskUserQuestion",
          toolCallId: "q2",
          state: "output-available",
          input: { questions },
          output: { answer: { kind: "single", selectedIds: ["opus"] } },
        }}
        chatStatus="ready"
      />
    </div>
  )
}

export function Skipped() {
  return (
    <div className="w-[28rem]">
      <QuestionTool
        part={{
          type: "tool-AskUserQuestion",
          toolCallId: "q3",
          state: "output-available",
          input: { questions },
          output: { answer: { kind: "skip" } },
        }}
        chatStatus="ready"
      />
    </div>
  )
}
