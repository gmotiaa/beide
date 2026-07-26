import { Kbd, KbdGroup } from "beide"
import { ArrowBigUp, Command as CommandIcon, CornerDownLeft } from "lucide-react"

export function SingleKeys() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
      <Kbd>Esc</Kbd>
      <Kbd>Tab</Kbd>
      <Kbd>Enter</Kbd>
      <Kbd>⌥</Kbd>
    </div>
  )
}

export function WithIcons() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Kbd>
        <CommandIcon />
      </Kbd>
      <Kbd>
        <ArrowBigUp />
      </Kbd>
      <Kbd>
        <CornerDownLeft />
      </Kbd>
    </div>
  )
}

export function InlineInText() {
  return (
    <p className="max-w-sm text-sm text-muted-foreground">
      Press{" "}
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>{" "}
      to open the command palette, or{" "}
      <KbdGroup>
        <Kbd>⇧</Kbd>
        <Kbd>Tab</Kbd>
      </KbdGroup>{" "}
      to cycle the agent mode. Keys are pointer-inert and never intercept a
      click on the surrounding text.
    </p>
  )
}
