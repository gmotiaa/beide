import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "beide"

export function BetweenGroups() {
  return (
    <div className="flex h-96 w-64 items-start">
      <Select defaultValue="Plan" defaultOpen modal={false}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Safe</SelectLabel>
            <SelectItem value="Plan">Plan</SelectItem>
            <SelectItem value="Ask each time">Ask each time</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Autonomous</SelectLabel>
            <SelectItem value="Accept edits">Accept edits</SelectItem>
            <SelectItem value="Bypass permissions">
              Bypass permissions
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
