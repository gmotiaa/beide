import { Input, Label, Switch } from "beide"

export function WithInput() {
  return (
    <div className="flex w-72 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds-name">Workspace name</Label>
        <Input id="ds-name" defaultValue="beide" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds-branch">Branch</Label>
        <Input id="ds-branch" defaultValue="master" />
      </div>
    </div>
  )
}

export function Inline() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <Label className="flex items-center justify-between">
        Auto-approve reads
        <Switch defaultChecked />
      </Label>
      <Label className="flex items-center justify-between">
        Stream tool output
        <Switch />
      </Label>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex w-72 flex-col gap-1.5">
      <Label htmlFor="ds-api" className="group" data-disabled>
        API key
      </Label>
      <Input id="ds-api" disabled placeholder="Managed by your organisation" />
    </div>
  )
}
