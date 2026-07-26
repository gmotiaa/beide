import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "beide"
import { Settings2 } from "lucide-react"

export function Open() {
  return (
    <div className="flex h-80 items-start justify-center pt-2">
      <Popover open modal={false}>
        <PopoverTrigger
          render={
            <Button variant="outline">
              <Settings2 />
              Rename workspace
            </Button>
          }
        />
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Rename workspace</PopoverTitle>
            <PopoverDescription>
              Only affects how it appears in the sidebar.
            </PopoverDescription>
          </PopoverHeader>
          <div className="mt-3 flex flex-col gap-1.5">
            <Label htmlFor="ds-ws">Name</Label>
            <Input id="ds-ws" defaultValue="beide" />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
            <Button size="sm">Save</Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
