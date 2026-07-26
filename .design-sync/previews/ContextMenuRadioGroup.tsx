import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "beide"

export function SingleChoice() {
  return (
    <div className="flex h-80 items-start justify-center">
      <ContextMenu open>
        <ContextMenuTrigger
          render={
            <div className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Editor gutter
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuRadioGroup value="name">
            <ContextMenuLabel>Sort files by</ContextMenuLabel>
            <ContextMenuRadioItem value="name">Name</ContextMenuRadioItem>
            <ContextMenuRadioItem value="modified">
              Last modified
            </ContextMenuRadioItem>
            <ContextMenuRadioItem value="size">Size</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
          <ContextMenuSeparator />
          <ContextMenuRadioGroup value="folders">
            <ContextMenuLabel>Group</ContextMenuLabel>
            <ContextMenuRadioItem value="folders">
              Folders first
            </ContextMenuRadioItem>
            <ContextMenuRadioItem value="flat">Flat list</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
