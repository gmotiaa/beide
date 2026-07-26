import { IconSpinner } from "beide"

export function Default() {
  return (
    <div className="flex items-center gap-4">
      <IconSpinner />
      <span className="text-sm text-muted-foreground">
        The default className already carries animate-spin and the muted colour.
      </span>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex items-end gap-4 text-muted-foreground">
      <IconSpinner className="size-3 animate-spin" />
      <IconSpinner className="size-4 animate-spin" />
      <IconSpinner className="size-6 animate-spin" />
      <IconSpinner className="size-8 animate-spin" />
    </div>
  )
}

export function InStatusRow() {
  return (
    <div className="flex w-72 flex-col gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <IconSpinner className="size-3.5 animate-spin" />
        <span>Running npm run build…</span>
      </div>
      <div className="flex items-center gap-2">
        <IconSpinner className="size-3.5 animate-spin text-primary" />
        <span>Thinking</span>
      </div>
    </div>
  )
}
