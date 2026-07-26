import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "beide"
import { FilePlus2, FolderOpen, GitBranch, TerminalSquare } from "lucide-react"
import type { ReactNode } from "react"

// CommandDialog wraps DialogContent — a portal with fixed positioning, which
// leaves nothing in its own subtree to measure. Stage gives it a real box.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-[24rem] w-full rounded-lg border border-border/60 bg-background">
      {children}
    </div>
  )
}

export function Open() {
  return (
    <Stage>
      <CommandDialog open>
        <CommandInput placeholder="Search commands…" />
        <CommandList>
          <CommandGroup heading="Files">
            <CommandItem>
              <FilePlus2 />
              New file
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <FolderOpen />
              Open folder…
              <CommandShortcut>⌘O</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Workspace">
            <CommandItem>
              <TerminalSquare />
              Toggle terminal
              <CommandShortcut>⌃`</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <GitBranch />
              Switch branch
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </Stage>
  )
}
