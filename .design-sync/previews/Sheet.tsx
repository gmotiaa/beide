import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "beide"
import type { ReactNode } from "react"

// SheetContent renders through a portal with fixed positioning, so it leaves
// nothing in its own subtree to measure. Stage gives every story a real box.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[26rem] w-full rounded-lg border border-border/60 bg-background">
      {children}
    </div>
  )
}

export function Right() {
  return (
    <Stage>
      <Sheet open modal={false}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Session settings</SheetTitle>
            <SheetDescription>Applies to this session only.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Model</span>
              <span className="text-foreground">Claude Opus 5</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Mode</span>
              <span className="text-foreground">Plan</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Auto-approve</span>
              <span className="text-foreground">Reads only</span>
            </div>
          </div>
          <SheetFooter>
            <Button>Save</Button>
            <Button variant="ghost">Reset to defaults</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Stage>
  )
}

export function Bottom() {
  return (
    <Stage>
      <Sheet open modal={false}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Attach files</SheetTitle>
            <SheetDescription>
              side="bottom" pins the sheet to the full width of the viewport and
              lets it size to its content.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="flex-row justify-end">
            <Button variant="outline">Cancel</Button>
            <Button>Attach</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Stage>
  )
}
