import { PlanTool } from "beide"

const plan = {
  id: "checkpoint-restore",
  title: "Restore editor buffers when a checkpoint is rolled back",
  summary: [
    "## Why",
    "",
    "Rolling back a checkpoint restores the workspace on disk but leaves the",
    "editor holding stale buffers, so the tab bar keeps files that no longer",
    "exist.",
    "",
    "## Steps",
    "",
    "1. Emit the restored file list from `checkpoints.ts`.",
    "2. Diff it against the open tabs in `stores/editor.ts`.",
    "3. Close orphans, reload the rest from disk.",
  ].join("\n"),
}

export function Proposed() {
  return (
    <div className="w-[30rem]">
      <PlanTool
        part={{
          type: "tool-PlanWrite",
          toolCallId: "p1",
          state: "output-available",
          input: { plan },
        }}
        chatStatus="ready"
      />
    </div>
  )
}

export function Approved() {
  return (
    <div className="w-[30rem]">
      <PlanTool
        part={{
          type: "tool-PlanWrite",
          toolCallId: "p2",
          state: "output-available",
          input: { plan, approved: true },
        }}
        chatStatus="ready"
      />
    </div>
  )
}

export function TitleOnly() {
  return (
    <div className="w-[30rem]">
      <PlanTool
        part={{
          type: "tool-PlanWrite",
          toolCallId: "p3",
          state: "output-available",
          input: { plan: { title: "Split the terminal into panes" } },
        }}
        chatStatus="ready"
      />
    </div>
  )
}
