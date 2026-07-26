import { Separator } from "beide"

export function Horizontal() {
  return (
    <div className="flex w-72 flex-col gap-3 text-sm">
      <div>
        <div className="font-medium">Session</div>
        <div className="text-muted-foreground">Started 14:02</div>
      </div>
      <Separator />
      <div>
        <div className="font-medium">Model</div>
        <div className="text-muted-foreground">Claude Opus 5</div>
      </div>
      <Separator />
      <div>
        <div className="font-medium">Workspace</div>
        <div className="text-muted-foreground">~/Developing/ide</div>
      </div>
    </div>
  )
}

export function Vertical() {
  return (
    <div className="flex h-6 items-center gap-3 text-sm text-muted-foreground">
      <span>master</span>
      <Separator orientation="vertical" />
      <span>63 changed</span>
      <Separator orientation="vertical" />
      <span>UTF-8</span>
      <Separator orientation="vertical" />
      <span>TypeScript</span>
    </div>
  )
}
