import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "beide"
import type { ReactNode } from "react"

// DialogContent renders through a portal with fixed positioning, so it leaves
// nothing in its own subtree to measure. Stage gives every story a real box.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[22rem] w-full rounded-lg border border-border/60 bg-background">
      {children}
    </div>
  )
}

export function TitleAndDescription() {
  return (
    <Stage>
      <Dialog open modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore checkpoint</DialogTitle>
            <DialogDescription>
              The header is a plain column with an 8px gap — the title sits on
              leading-none, the description in muted foreground below it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button>Restore</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stage>
  )
}
