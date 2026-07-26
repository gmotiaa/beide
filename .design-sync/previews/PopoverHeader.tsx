import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "beide"
import { Info } from "lucide-react"

export function TitleAndDescription() {
  return (
    <div className="flex h-80 items-start justify-center pt-2">
      <Popover open modal={false}>
        <PopoverTrigger
          render={
            <Button variant="outline">
              <Info />
              About this session
            </Button>
          }
        />
        <PopoverContent>
          <PopoverHeader>
            <PopoverTitle>Sandboxed session</PopoverTitle>
            <PopoverDescription>
              The header is a 4px column: a semibold title at text-sm over a
              muted description at text-xs.
            </PopoverDescription>
          </PopoverHeader>
          <p className="mt-3 text-sm text-muted-foreground">
            Body content follows the header inside the popover's own 16px
            padding.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
