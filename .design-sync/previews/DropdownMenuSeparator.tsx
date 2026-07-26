import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "beide"
import { ChevronDown, LogOut, RotateCcw, Save, Trash2 } from "lucide-react"

export function DividingSections() {
  return (
    <div className="flex h-72 items-start justify-center pt-2">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="w-56 justify-between">
              Account
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuItem>
            <Save />
            Save workspace
          </DropdownMenuItem>
          <DropdownMenuItem>
            <RotateCcw />
            Reset layout
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <LogOut />
            Sign out
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
