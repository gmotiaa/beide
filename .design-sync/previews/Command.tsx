import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "beide"
import { FilePlus2, FolderOpen, GitBranch, Settings, TerminalSquare } from "lucide-react"

function Frame({ children }) {
  return (
    <div className="w-96 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function Palette() {
  return (
    <Frame>
      <Command>
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
            <CommandItem disabled>
              <Settings />
              Reload window
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function EmptyState() {
  return (
    <Frame>
      <Command>
        <CommandInput value="zzz" placeholder="Search commands…" />
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function FlatList() {
  return (
    <Frame>
      <Command>
        <CommandInput placeholder="Go to file…" />
        <CommandList>
          <CommandGroup>
            <CommandItem>src/components/ui/button.tsx</CommandItem>
            <CommandItem>src/components/ui/command.tsx</CommandItem>
            <CommandItem>src/stores/agent.ts</CommandItem>
            <CommandItem>electron/services/sessions.ts</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}
