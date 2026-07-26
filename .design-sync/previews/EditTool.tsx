import { EditTool } from "beide"

const OLD = `export function formatCost(usd: number) {
  return \`$\${usd.toFixed(2)}\`
}`

const NEW = `export function formatCost(usd: number) {
  if (usd < 0.01) return "<$0.01"
  return \`$\${usd.toFixed(2)}\`
}`

export function Edited() {
  return (
    <div className="w-[30rem]">
      <EditTool
        part={{
          type: "tool-Edit",
          toolCallId: "e1",
          state: "output-available",
          input: {
            file_path: "src/lib/format-cost.ts",
            old_string: OLD,
            new_string: NEW,
          },
          output: {
            structuredPatch: [{ lines: [" export function formatCost(usd: number) {", '+  if (usd < 0.01) return "<$0.01"', "   return `$${usd.toFixed(2)}`", " }"] }],
          },
        }}
      />
    </div>
  )
}

export function Generating() {
  return (
    <div className="w-[30rem]">
      <EditTool
        part={{
          type: "tool-Edit",
          toolCallId: "e2",
          state: "input-streaming",
          input: { file_path: "src/stores/usage.ts" },
        }}
      />
    </div>
  )
}
