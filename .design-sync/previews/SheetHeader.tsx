import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "beide"

export function TitleAndDescription() {
  return (
    <div className="relative h-[26rem] w-full rounded-lg border border-border/60 bg-background">
      <Sheet open modal={false}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Checkpoints</SheetTitle>
            <SheetDescription>
              A tight 2px gap between title and description, with the sheet's
              own 16px padding — the header is the only part of a sheet that
              pads itself.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 text-sm text-muted-foreground">
            Body content supplies its own padding, so a scroll region can run
            edge to edge under the header.
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
