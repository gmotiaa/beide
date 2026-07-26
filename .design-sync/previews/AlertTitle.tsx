import { Alert, AlertDescription, AlertTitle } from "beide"
import { Info } from "lucide-react"

export function InAlert() {
  return (
    <div className="flex w-96 flex-col gap-3">
      <Alert variant="info">
        <Info />
        <AlertTitle>Medium weight, tight tracking</AlertTitle>
        <AlertDescription>
          The title always occupies the second grid column, aligned with the
          description under it.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function Alone() {
  return (
    <div className="flex w-96 flex-col gap-3">
      <Alert>
        <Info />
        <AlertTitle>Reconnected to the agent</AlertTitle>
      </Alert>
      <Alert variant="warning">
        <AlertTitle>Session limit reached</AlertTitle>
      </Alert>
    </div>
  )
}
