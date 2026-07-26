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

export function Open() {
  return (
    <Stage>
      <Dialog open modal={false}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allow this command?</DialogTitle>
            <DialogDescription>
              The agent wants to run <code>npm run build</code> in
              ~/Developing/ide. Approving once applies to this command only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline">Deny</Button>
            <Button>Allow once</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stage>
  )
}
