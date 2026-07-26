import { Alert, AlertDescription, AlertTitle } from "beide"
import { CircleAlert } from "lucide-react"

export function Basic() {
  return (
    <div className="flex w-96 flex-col gap-3">
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Permission denied</AlertTitle>
        <AlertDescription>
          Muted foreground at text-sm, in the same column as the title.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function MultipleBlocks() {
  return (
    <div className="flex w-96 flex-col gap-3">
      <Alert variant="warning">
        <AlertTitle>Two paragraphs</AlertTitle>
        <AlertDescription>
          <p>
            The description is itself a grid, so each child becomes its own row
            with a 4px gap.
          </p>
          <p>
            Paragraphs get relaxed leading, and children are justified to the
            start rather than stretched.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}
