import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "beide"

function Frame({ children }) {
  return (
    <div className="w-80 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function BetweenGroups() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup heading="Edit">
            <CommandItem>Undo</CommandItem>
            <CommandItem>Redo</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Selection">
            <CommandItem>Select all</CommandItem>
            <CommandItem>Expand selection</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Danger">
            <CommandItem>Discard changes</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function BetweenItems() {
  return (
    <Frame>
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem>Accept edit</CommandItem>
            <CommandItem>Reject edit</CommandItem>
            <CommandSeparator className="my-1" />
            <CommandItem>Restore checkpoint</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}
