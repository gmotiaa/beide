import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "beide"
import { Settings2 } from "lucide-react"

export function Basic() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>
          Two rows: the title, then the description below it.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        The header owns the horizontal padding; content lines up with it.
      </CardContent>
    </Card>
  )
}

export function WithAction() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Model</CardTitle>
        <CardDescription>Claude Opus 5 · extended thinking</CardDescription>
        <CardAction>
          <Button variant="outline" size="icon-sm" aria-label="Configure">
            <Settings2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        A CardAction child switches the header to a 1fr/auto grid and pins the
        action to the top-right across both rows.
      </CardContent>
    </Card>
  )
}

export function Bordered() {
  return (
    <Card className="w-80">
      <CardHeader className="border-b">
        <CardTitle>Session log</CardTitle>
        <CardDescription>
          Adding border-b makes the header pad its own bottom edge.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        Useful when the card body is a list and needs a hard divider.
      </CardContent>
    </Card>
  )
}
