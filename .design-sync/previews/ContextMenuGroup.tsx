import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "beide"
import { GitCommit, GitPullRequest, History, Undo2 } from "lucide-react"

export function LabelledGroups() {
  return (
    <div className="flex h-80 items-start justify-center">
      <ContextMenu open>
        <ContextMenuTrigger
          render={
            <div className="flex h-20 w-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Changed file
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuGroup>
            <ContextMenuLabel>Changes</ContextMenuLabel>
            <ContextMenuItem>
              <History />
              View diff
            </ContextMenuItem>
            <ContextMenuItem>
              <Undo2 />
              Discard changes
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuLabel>Git</ContextMenuLabel>
            <ContextMenuItem>
              <GitCommit />
              Stage file
            </ContextMenuItem>
            <ContextMenuItem>
              <GitPullRequest />
              Open on remote
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
