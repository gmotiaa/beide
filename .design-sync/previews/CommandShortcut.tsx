import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "beide"
import { FilePlus2, Save, Search } from "lucide-react"

function Frame({ children }) {
  return (
    <div className="w-80 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function TrailingKeys() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup heading="Frequent">
            <CommandItem>
              <FilePlus2 />
              New file
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Save />
              Save
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Search />
              Find in files
              <CommandShortcut>⌘⇧F</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function LongLabels() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>
              Toggle integrated terminal panel
              <CommandShortcut>⌃`</CommandShortcut>
            </CommandItem>
            <CommandItem>
              Restore the previous checkpoint
              <CommandShortcut>⌘Z</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}
