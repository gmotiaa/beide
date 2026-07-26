import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "beide"

export function Basic() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Model context</CardTitle>
        <CardDescription>What the agent can see right now.</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        Content adds only the horizontal card padding — vertical rhythm comes
        from the card's own gap, so stacked sections never double-space.
      </CardContent>
    </Card>
  )
}

export function WithRows() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {[
          ["Input tokens", "1.2M"],
          ["Output tokens", "184K"],
          ["Cache reads", "8.6M"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium tabular-nums">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
