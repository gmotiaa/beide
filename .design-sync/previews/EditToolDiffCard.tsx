import { EditToolDiffCard } from "beide"

const noop = () => {}

const OLD = `const MODELS = ["opus", "sonnet"]`
const NEW = `const MODELS = ["opus", "sonnet", "haiku"]`

const step = {
  id: "diff",
  type: "tool-call" as const,
  toolName: "Edit",
  toolDetail: "models.ts",
  duration: Number.MAX_SAFE_INTEGER,
  filePath: "src/lib/models.ts",
  diffStats: "+1 -1",
}

export function Edited() {
  return (
    <div className="w-[30rem]">
      <EditToolDiffCard
        step={step}
        state="complete"
        onComplete={noop}
        input={{ old_string: OLD, new_string: NEW }}
      />
    </div>
  )
}

export function Created() {
  return (
    <div className="w-[30rem]">
      <EditToolDiffCard
        step={{
          ...step,
          id: "written",
          toolName: "Write",
          toolDetail: "flags.ts",
          filePath: "src/lib/flags.ts",
          diffStats: "+2",
        }}
        state="complete"
        onComplete={noop}
        input={{
          old_string: "",
          new_string: 'export const FLAGS = {\n  fastMode: true,\n}',
        }}
      />
    </div>
  )
}

export function Collapsible() {
  return (
    <div className="w-[30rem]">
      <EditToolDiffCard
        step={{ ...step, id: "long", diffStats: "+6 -1" }}
        state="complete"
        onComplete={noop}
        isCollapsible
        input={{
          old_string: OLD,
          new_string: [
            'const MODELS = [',
            '  "opus",',
            '  "sonnet",',
            '  "haiku",',
            '  "fable",',
            ']',
          ].join("\n"),
        }}
      />
    </div>
  )
}
