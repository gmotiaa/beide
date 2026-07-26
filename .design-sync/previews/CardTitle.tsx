import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "beide"

export function InCard() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Checkpoints</CardTitle>
        <CardDescription>
          text-base, medium weight, snug leading.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        The title is a plain div, so it carries no heading semantics — pass
        your own element when the outline matters.
      </CardContent>
    </Card>
  )
}

export function ScalesWithCardSize() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="w-72">
        <CardHeader>
          <CardTitle>Default card — text-base</CardTitle>
        </CardHeader>
      </Card>
      <Card size="sm" className="w-72">
        <CardHeader>
          <CardTitle>Compact card — text-sm</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}
