import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "beide"
import { X } from "lucide-react"

export function WithButton() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Update available</CardTitle>
        <CardDescription>Version 0.2.0 is ready to install.</CardDescription>
        <CardAction>
          <Button size="sm">Install</Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        The action spans both header rows and sits flush with the title's top
        edge, not centred against the pair.
      </CardContent>
    </Card>
  )
}

export function WithIconButton() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Terminal exited</CardTitle>
        <CardDescription>Process finished with code 1.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-sm" aria-label="Dismiss">
            <X />
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  )
}
