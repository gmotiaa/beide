import { Button, IconArrowRight } from "beide"

export function Sizes() {
  return (
    <div className="flex items-end gap-4 text-foreground">
      <IconArrowRight className="size-4" />
      <IconArrowRight className="size-5" />
      <IconArrowRight className="size-6" />
      <IconArrowRight className="size-8" />
    </div>
  )
}

export function InSubmitButton() {
  return (
    <div className="flex items-center gap-3">
      <Button size="icon" aria-label="Send">
        <IconArrowRight className="size-4" />
      </Button>
      <Button variant="outline" size="icon" aria-label="Send">
        <IconArrowRight className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Send" disabled>
        <IconArrowRight className="size-4" />
      </Button>
    </div>
  )
}

export function Colours() {
  return (
    <div className="flex items-center gap-4">
      <IconArrowRight className="size-5 text-foreground" />
      <IconArrowRight className="size-5 text-muted-foreground" />
      <IconArrowRight className="size-5 text-primary" />
    </div>
  )
}
