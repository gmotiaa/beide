import { Kbd, KbdGroup } from "beide"

export function Combinations() {
  return (
    <div className="flex flex-col items-start gap-3">
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>⇧</Kbd>
        <Kbd>P</Kbd>
      </KbdGroup>
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>`</Kbd>
      </KbdGroup>
    </div>
  )
}

export function InShortcutList() {
  return (
    <div className="flex w-72 flex-col gap-2 text-sm">
      {[
        ["Command palette", ["⌘", "K"]],
        ["Toggle terminal", ["Ctrl", "`"]],
        ["New session", ["⌘", "N"]],
        ["Accept edit", ["⌘", "⏎"]],
      ].map(([label, keys]) => (
        <div key={label as string} className="flex items-center justify-between">
          <span className="text-muted-foreground">{label}</span>
          <KbdGroup>
            {(keys as string[]).map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </KbdGroup>
        </div>
      ))}
    </div>
  )
}
