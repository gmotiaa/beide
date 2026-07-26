import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "beide"
import { Bug, GitCommit, Play, RefreshCw } from "lucide-react"

function Frame({ children }) {
  return (
    <div className="w-96 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function WithHeadings() {
  return (
    <Frame>
      <Command>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandGroup heading="Run">
            <CommandItem>
              <Play />
              Start dev server
            </CommandItem>
            <CommandItem>
              <Bug />
              Debug main process
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Source control">
            <CommandItem>
              <GitCommit />
              Commit staged
            </CommandItem>
            <CommandItem>
              <RefreshCw />
              Sync with remote
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function WithoutHeading() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>Copy path</CommandItem>
            <CommandItem>Reveal in file tree</CommandItem>
            <CommandItem>Rename…</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}
