import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "beide"
import { ChevronDown } from "lucide-react"

export function SingleChoice() {
  return (
    <div className="flex h-80 items-start justify-center pt-2">
      <DropdownMenu open modal={false}>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="w-56 justify-between">
              Opus 5
              <ChevronDown />
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="opus">
            <DropdownMenuLabel>Model</DropdownMenuLabel>
            <DropdownMenuRadioItem value="opus">
              Claude Opus 5
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="sonnet">
              Claude Sonnet 5
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="haiku">
              Claude Haiku 4.5
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value="high">
            <DropdownMenuLabel>Thinking</DropdownMenuLabel>
            <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="high">Extended</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
