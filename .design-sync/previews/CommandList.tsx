import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "beide"

function Frame({ children }) {
  return (
    <div className="w-96 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10">
      {children}
    </div>
  )
}

export function Short() {
  return (
    <Frame>
      <Command>
        <CommandInput placeholder="Search…" />
        <CommandList>
          <CommandGroup>
            <CommandItem>
              Save all
              <CommandShortcut>⌘⌥S</CommandShortcut>
            </CommandItem>
            <CommandItem>
              Close editor
              <CommandShortcut>⌘W</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}

export function Scrolling() {
  const files = [
    "src/components/ui/button.tsx",
    "src/components/ui/card.tsx",
    "src/components/ui/command.tsx",
    "src/components/ui/dialog.tsx",
    "src/components/ui/select.tsx",
    "src/components/ui/tabs.tsx",
    "src/stores/agent.ts",
    "src/stores/chat.ts",
    "src/stores/editor.ts",
    "src/stores/settings.ts",
    "electron/ipc.ts",
    "electron/main.ts",
    "electron/services/agent.ts",
    "electron/services/sessions.ts",
  ]
  return (
    <Frame>
      <Command>
        <CommandInput placeholder="Go to file…" />
        <CommandList>
          <CommandGroup heading="14 matches">
            {files.map((f) => (
              <CommandItem key={f}>{f}</CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Frame>
  )
}
