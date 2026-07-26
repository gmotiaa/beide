import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "beide"

export function Basic() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Auto-approve</CardTitle>
        <CardDescription>
          Muted foreground at text-sm, one row below the title.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        Its presence is what gives the header its two-row grid.
      </CardContent>
    </Card>
  )
}

export function Multiline() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Sandbox</CardTitle>
        <CardDescription>
          Commands run inside a restricted environment with no network access
          and a read-only filesystem outside the workspace. Anything that needs
          more asks for permission first.
        </CardDescription>
      </CardHeader>
    </Card>
  )
}
