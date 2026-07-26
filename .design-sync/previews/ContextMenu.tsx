import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "beide"
import { Copy, FolderOpen, Pencil, Trash2 } from "lucide-react"

export function Open() {
  return (
    <div className="flex h-80 items-start justify-center">
      <ContextMenu open>
        <ContextMenuTrigger
          render={
            <div className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              src/stores/agent.ts
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuLabel>agent.ts</ContextMenuLabel>
            <ContextMenuItem>
              <FolderOpen />
              Reveal in file tree
            </ContextMenuItem>
            <ContextMenuItem>
              <Copy />
              Copy relative path
              <ContextMenuShortcut>⌘⇧C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Pencil />
              Rename…
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive">
            <Trash2 />
            Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

export function TriggerSurface() {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={
          <div className="flex h-24 w-72 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Right-click anywhere in this area
          </div>
        }
      />
      <ContextMenuContent>
        <ContextMenuItem>Copy</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
