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

export function GroupedOptions() {
  return (
    <div className="flex h-96 w-64 items-start">
      <Select defaultValue="Claude Opus 5" defaultOpen modal={false}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Claude 5</SelectLabel>
            <SelectItem value="Claude Opus 5">Claude Opus 5</SelectItem>
            <SelectItem value="Claude Sonnet 5">Claude Sonnet 5</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Fast</SelectLabel>
            <SelectItem value="Claude Haiku 4.5">Claude Haiku 4.5</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
