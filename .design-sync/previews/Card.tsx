import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "beide"
import { MoreHorizontal } from "lucide-react"

export function Default() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          The folder the agent reads and writes in.
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="More">
            <MoreHorizontal />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          ~/Desktop/Developing/ide — 180 tracked files, git branch{" "}
          <span className="text-foreground">master</span>.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">
          Change
        </Button>
        <Button size="sm">Open</Button>
      </CardFooter>
    </Card>
  )
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="w-72">
        <CardHeader>
          <CardTitle>Default spacing</CardTitle>
          <CardDescription>--card-spacing is 16px</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          Title renders at text-base.
        </CardContent>
      </Card>
      <Card size="sm" className="w-72">
        <CardHeader>
          <CardTitle>Compact spacing</CardTitle>
          <CardDescription>--card-spacing is 12px</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          size="sm" also drops the title to text-sm.
        </CardContent>
      </Card>
    </div>
  )
}

export function ContentOnly() {
  return (
    <Card className="w-80">
      <CardContent className="flex flex-col gap-1">
        <span className="font-medium">Usage this month</span>
        <span className="text-2xl font-medium tabular-nums">$41.20</span>
        <span className="text-muted-foreground">
          Across 1,284 requests on Opus 5.
        </span>
      </CardContent>
    </Card>
  )
}
