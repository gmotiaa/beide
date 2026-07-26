import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "beide"
import { Copy, Scissors, Trash2 } from "lucide-react"

export function DividingSections() {
  return (
    <div className="flex h-80 items-start justify-center">
      <ContextMenu open>
        <ContextMenuTrigger
          render={
            <div className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Selection
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem>
            <Copy />
            Copy
          </ContextMenuItem>
          <ContextMenuItem>
            <Scissors />
            Cut
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem>Add to chat</ContextMenuItem>
          <ContextMenuItem>Explain selection</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            <Trash2 />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
