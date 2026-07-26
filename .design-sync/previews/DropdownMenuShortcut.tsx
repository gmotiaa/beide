import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "beide"
import { ChevronDown, Copy, Scissors, Trash2, Undo2 } from "lucide-react"

export function TrailingKeys() {
  return (
    <div className="flex h-72 items-start justify-center pt-2">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="w-56 justify-between">
              Edit
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Undo2 />
            Undo
            <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Scissors />
            Cut
            <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy />
            Copy
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Delete
            <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
