import { Button, Spinner } from "beide"

export function Sizes() {
  return (
    <div className="flex items-end gap-5">
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner />
      <Spinner size="lg" />
      <Spinner size="xl" />
    </div>
  )
}

export function Colours() {
  return (
    <div className="flex items-center gap-5">
      <Spinner size="lg" className="text-foreground" />
      <Spinner size="lg" className="text-muted-foreground" />
      <Spinner size="lg" className="text-primary" />
      <Spinner size="lg" className="text-destructive" />
    </div>
  )
}

export function InContext() {
  return (
    <div className="flex flex-col items-start gap-4">
      <Button disabled>
        <Spinner size="sm" />
        Working…
      </Button>
      <Button variant="outline" size="sm" disabled>
        <Spinner size="xs" />
        Reconnecting
      </Button>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        Loading session history
      </div>
    </div>
  )
}
