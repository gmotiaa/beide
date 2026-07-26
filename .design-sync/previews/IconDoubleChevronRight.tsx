import { Button, IconDoubleChevronRight } from "beide"

export function Sizes() {
  return (
    <div className="flex items-end gap-4 text-foreground">
      <IconDoubleChevronRight className="size-3" />
      <IconDoubleChevronRight className="size-4" />
      <IconDoubleChevronRight className="size-5" />
      <IconDoubleChevronRight className="size-8" />
    </div>
  )
}

export function InPanelToggle() {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon-sm" aria-label="Collapse panel">
        <IconDoubleChevronRight className="size-3.5" />
      </Button>
      <Button variant="outline" size="icon-sm" aria-label="Collapse panel">
        <IconDoubleChevronRight className="size-3.5" />
      </Button>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <IconDoubleChevronRight className="size-3.5" />
        <span>Skip to end</span>
      </div>
    </div>
  )
}
