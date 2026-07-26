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

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[26rem] w-full rounded-lg border border-border/60 bg-background">
      {children}
    </div>
  )
}

export function PinnedToBottom() {
  return (
    <Stage>
      <Sheet open modal={false}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Discard changes</SheetTitle>
            <SheetDescription>
              mt-auto pushes the footer to the bottom of the sheet regardless of
              how short the body is.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="destructive">Discard 63 files</Button>
            <Button variant="ghost">Keep changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Stage>
  )
}

export function HorizontalActions() {
  return (
    <Stage>
      <Sheet open modal={false}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Export session</SheetTitle>
            <SheetDescription>
              The default stack is vertical; a flex-row override puts the
              actions side by side.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="flex-row justify-end">
            <Button variant="outline">Cancel</Button>
            <Button>Export</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Stage>
  )
}
