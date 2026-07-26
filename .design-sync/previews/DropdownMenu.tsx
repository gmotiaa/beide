import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "beide"
import { ChevronDown, Copy, GitBranch, Settings, Trash2 } from "lucide-react"

export function Open() {
  return (
    <div className="flex h-72 items-start justify-center pt-2">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="w-56 justify-between">
              Session
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Session</DropdownMenuLabel>
            <DropdownMenuItem>
              <Copy />
              Copy session id
              <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <GitBranch />
              Fork from here
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Settings />
              Edit system prompt
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked>
            Auto-approve reads
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Delete session
            <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function Closed() {
  return (
    <div className="flex items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline">
              Actions
              <ChevronDown />
            </Button>
          }
        />
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="More">
              <Settings />
            </Button>
          }
        />
      </DropdownMenu>
    </div>
  )
}
