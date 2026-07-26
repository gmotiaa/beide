import { Command, CommandEmpty, CommandInput, CommandList } from "beide"

function Frame({ children }) {
  return (
    <div className="w-96 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function NoResults() {
  return (
    <Frame>
      <Command>
        <CommandInput value="quantum" placeholder="Search commands…" />
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function WithHint() {
  return (
    <Frame>
      <Command>
        <CommandInput value="src/legacy" placeholder="Go to file…" />
        <CommandList>
          <CommandEmpty>
            Nothing matches “src/legacy”.
            <br />
            Try a shorter fragment of the path.
          </CommandEmpty>
        </CommandList>
      </Command>
    </Frame>
  )
}
