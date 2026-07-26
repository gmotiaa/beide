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

export function TwoActions() {
  return (
    <Stage>
      <Dialog open modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session</DialogTitle>
            <DialogDescription>
              The footer bleeds to the dialog edges, picks up the muted surface
              and a top border, and right-aligns its buttons from the sm
              breakpoint up.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button variant="destructive">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stage>
  )
}

export function WithBuiltInClose() {
  return (
    <Stage>
      <Dialog open modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release notes</DialogTitle>
            <DialogDescription>
              showCloseButton renders the dialog's own outline Close action as
              the last child of the footer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </Stage>
  )
}
