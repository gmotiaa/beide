import { Alert, AlertDescription, AlertTitle } from "beide"
import { AlertTriangle, CircleAlert, Info, Terminal } from "lucide-react"

export function Variants() {
  return (
    <div className="flex w-96 flex-col gap-3">
      <Alert>
        <Terminal />
        <AlertTitle>Checkpoint saved</AlertTitle>
        <AlertDescription>
          You can restore this state from the session menu.
        </AlertDescription>
      </Alert>
      <Alert variant="info">
        <Info />
        <AlertTitle>Plan mode is on</AlertTitle>
        <AlertDescription>
          The agent will propose changes without writing files.
        </AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Uncommitted changes</AlertTitle>
        <AlertDescription>
          63 files differ from the last commit.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Build failed</AlertTitle>
        <AlertDescription>
          tsc exited with code 2 — see the terminal for details.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function WithoutIcon() {
  return (
    <div className="flex w-96 flex-col gap-3">
      <Alert variant="info">
        <AlertTitle>No icon</AlertTitle>
        <AlertDescription>
          Without an svg child the grid collapses its icon column, so the text
          sits flush against the left padding.
        </AlertDescription>
      </Alert>
      <Alert>
        <AlertTitle>Title only</AlertTitle>
      </Alert>
    </div>
  )
}
