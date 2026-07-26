import { FileExtIcon } from "beide"

const FILES = [
  "agent.ts",
  "ChatPanel.tsx",
  "package.json",
  "global.css",
  "README.md",
  "setup.mjs",
  "index.html",
  "notes.txt",
]

export function ByExtension() {
  return (
    <div className="grid w-96 grid-cols-2 gap-2">
      {FILES.map((name) => (
        <div key={name} className="flex items-center gap-2 text-sm">
          <FileExtIcon filename={name} className="size-4 shrink-0" />
          <span className="truncate text-muted-foreground">{name}</span>
        </div>
      ))}
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex items-end gap-4">
      <FileExtIcon filename="ChatPanel.tsx" className="size-3" />
      <FileExtIcon filename="ChatPanel.tsx" className="size-4" />
      <FileExtIcon filename="ChatPanel.tsx" className="size-6" />
      <FileExtIcon filename="ChatPanel.tsx" className="size-8" />
    </div>
  )
}

export function InTabRow() {
  return (
    <div className="flex w-80 items-center gap-1 rounded-lg border border-border bg-card p-1">
      {["agent.ts", "global.css", "README.md"].map((name, i) => (
        <div
          key={name}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
            i === 0 ? "bg-muted text-foreground" : "text-muted-foreground"
          }`}
        >
          <FileExtIcon filename={name} className="size-3.5 shrink-0" />
          <span>{name}</span>
        </div>
      ))}
    </div>
  )
}
