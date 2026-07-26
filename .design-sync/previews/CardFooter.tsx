import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "beide"

export function WithActions() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Delete checkpoint</CardTitle>
        <CardDescription>This cannot be undone.</CardDescription>
      </CardHeader>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </CardFooter>
    </Card>
  )
}

export function WithMeta() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Bash</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        npm run build — finished in 8.4s
      </CardContent>
      <CardFooter className="justify-between text-muted-foreground">
        <span>Exit code 0</span>
        <span className="tabular-nums">14:02</span>
      </CardFooter>
    </Card>
  )
}
