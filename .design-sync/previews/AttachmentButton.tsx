import { AttachmentButton } from "beide"

export function Icons() {
  return (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <AttachmentButton icon="plus" />
        <span className="text-xs text-muted-foreground">plus</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <AttachmentButton icon="paperclip" />
        <span className="text-xs text-muted-foreground">paperclip</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <AttachmentButton
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4 text-muted-foreground"
            >
              <path d="M4 5h16v14H4z" />
              <path d="m4 15 4-4 4 4 3-3 5 5" />
            </svg>
          }
        />
        <span className="text-xs text-muted-foreground">custom node</span>
      </div>
    </div>
  )
}

export function InComposer() {
  return (
    <div className="w-full max-w-lg rounded-xl border border-border bg-card p-2">
      <div className="px-2 pt-1 pb-3 text-sm text-muted-foreground">
        Rename the checkpoint service and update its callers
      </div>
      <div className="flex items-center gap-1">
        <AttachmentButton icon="plus" />
        <AttachmentButton icon="paperclip" />
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>Opus 5</span>
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">
            ⏎
          </kbd>
        </div>
      </div>
    </div>
  )
}
