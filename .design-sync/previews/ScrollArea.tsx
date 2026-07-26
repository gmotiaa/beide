import { ScrollArea, Separator } from "beide"

export function LongList() {
  const files = [
    "electron/ipc.ts",
    "electron/main.ts",
    "electron/preload.ts",
    "electron/services/agent.ts",
    "electron/services/checkpoints.ts",
    "electron/services/paths.ts",
    "electron/services/permissions.ts",
    "electron/services/sessions.ts",
    "electron/services/settings.ts",
    "electron/services/usage.ts",
    "electron/services/workspace.ts",
    "src/stores/agent.ts",
    "src/stores/auth.ts",
    "src/stores/chat.ts",
    "src/stores/editor.ts",
    "src/stores/settings.ts",
  ]
  return (
    <ScrollArea className="h-56 w-72 rounded-lg ring-1 ring-foreground/10">
      <div className="p-3">
        {files.map((f, i) => (
          <div key={f}>
            {i > 0 && <Separator className="my-2" />}
            <div className="truncate text-sm text-muted-foreground">{f}</div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export function Prose() {
  return (
    <ScrollArea className="h-48 w-80 rounded-lg ring-1 ring-foreground/10">
      <div className="flex flex-col gap-3 p-4 text-sm text-muted-foreground">
        <p>
          The scrollbar is an overlay: it takes no layout width, so the content
          box is the same size whether or not the area overflows.
        </p>
        <p>
          It fades in on hover and while scrolling, which keeps dense panels —
          the file tree, the session list, tool output — visually quiet at rest.
        </p>
        <p>
          The viewport inherits the root's radius, so a rounded wrapper clips
          the content without any extra overflow rule.
        </p>
        <p>
          Focus lands on the viewport, giving keyboard users a visible ring and
          arrow-key scrolling.
        </p>
      </div>
    </ScrollArea>
  )
}
