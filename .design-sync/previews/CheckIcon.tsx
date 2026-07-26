import { CheckIcon } from "beide"

export function Sizes() {
  return (
    <div className="flex items-end gap-4 text-foreground">
      <CheckIcon className="size-3" />
      <CheckIcon className="size-4" />
      <CheckIcon className="size-5" />
      <CheckIcon className="size-8" />
    </div>
  )
}

export function Colours() {
  return (
    <div className="flex items-center gap-4">
      <CheckIcon className="size-5 text-foreground" />
      <CheckIcon className="size-5 text-muted-foreground" />
      <CheckIcon className="size-5 text-primary" />
      <CheckIcon className="size-5 text-accent" />
    </div>
  )
}

export function InContext() {
  return (
    <div className="flex w-72 flex-col gap-2 text-sm">
      {["Read 12 files", "Applied 3 edits", "Ran the test suite"].map((t) => (
        <div key={t} className="flex items-center gap-2">
          <CheckIcon className="size-3.5 shrink-0 text-primary" />
          <span className="text-muted-foreground">{t}</span>
        </div>
      ))}
    </div>
  )
}
