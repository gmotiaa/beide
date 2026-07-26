import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, Kbd } from "beide"

export function Open() {
  return (
    <TooltipProvider>
      <div className="flex h-32 w-72 items-center justify-center">
        <Tooltip open>
          <TooltipTrigger className="rounded-md border border-border px-3 py-1.5 text-sm">
            Toggle terminal
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Show the integrated terminal
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

export function WithShortcut() {
  return (
    <TooltipProvider>
      <div className="flex h-32 w-72 items-center justify-center">
        <Tooltip open>
          <TooltipTrigger className="rounded-md border border-border px-3 py-1.5 text-sm">
            Command palette
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Open the palette
            <Kbd>⌘K</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
