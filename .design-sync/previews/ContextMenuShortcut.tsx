import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "beide"
import { Copy, Save, Search, Trash2 } from "lucide-react"

export function TrailingKeys() {
  return (
    <div className="flex h-80 items-start justify-center">
      <ContextMenu open>
        <ContextMenuTrigger
          render={
            <div className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Editor
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem>
            <Copy />
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Save />
            Save
            <ContextMenuShortcut>⌘S</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <Search />
            Find in file
            <ContextMenuShortcut>⌘F</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            <Trash2 />
            Close without saving
            <ContextMenuShortcut>⌥⌘W</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
