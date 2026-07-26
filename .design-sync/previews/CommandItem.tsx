import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "beide"
import { Copy, Scissors, Trash2 } from "lucide-react"

function Frame({ children }) {
  return (
    <div className="w-80 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function Plain() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>Open in new tab</CommandItem>
            <CommandItem>Duplicate file</CommandItem>
            <CommandItem>Move to…</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function WithIconAndShortcut() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>
              <Copy />
              Copy
              <CommandShortcut>⌘C</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Scissors />
              Cut
              <CommandShortcut>⌘X</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Trash2 />
              Delete
              <CommandShortcut>⌫</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function Disabled() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>Paste</CommandItem>
            <CommandItem disabled>
              <Trash2 />
              Delete — read-only file
            </CommandItem>
            <CommandItem disabled>Undo</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}
