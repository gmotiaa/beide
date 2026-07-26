import { BashTool } from "beide"

export function Ran() {
  return (
    <div className="w-[28rem]">
      <BashTool
        part={{
          type: "tool-Bash",
          toolCallId: "b1",
          state: "output-available",
          input: { command: "npm run typecheck" },
          output: { stdout: "tsc --noEmit\nNo errors found.", exitCode: 0 },
        }}
      />
    </div>
  )
}

export function Running() {
  return (
    <div className="w-[28rem]">
      <BashTool
        part={{
          type: "tool-Bash",
          toolCallId: "b2",
          state: "input-available",
          input: { command: "npm test -- --run" },
        }}
      />
    </div>
  )
}

export function Failed() {
  return (
    <div className="w-[28rem]">
      <BashTool
        part={{
          type: "tool-Bash",
          toolCallId: "b3",
          state: "output-available",
          input: { command: "npm run lint" },
          output: {
            stdout: "",
            stderr: "src/stores/chat.ts:42:7  error  'draft' is never reassigned",
            exitCode: 1,
          },
        }}
      />
    </div>
  )
}
