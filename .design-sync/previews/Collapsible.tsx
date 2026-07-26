import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "beide"
import { ChevronDown } from "lucide-react"

export function Expanded() {
  return (
    <Collapsible defaultOpen className="w-80">
      <CollapsibleTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-between">
            Tool output — Bash
            <ChevronDown />
          </Button>
        }
      />
      <CollapsibleContent>
        <pre className="mt-2 rounded-lg bg-muted p-3 font-mono text-xs text-muted-foreground">
          {`> npm run build\n\nvite v7.1.14 building for production...\n✓ 412 modules transformed.\ndist/index.html   0.71 kB\n✓ built in 8.42s`}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Collapsed() {
  return (
    <Collapsible className="w-80">
      <CollapsibleTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-between">
            Tool output — Bash
            <ChevronDown />
          </Button>
        }
      />
      <CollapsibleContent>
        <pre className="mt-2 rounded-lg bg-muted p-3 font-mono text-xs">
          hidden until expanded
        </pre>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Sections() {
  return (
    <div className="flex w-80 flex-col gap-1">
      {[
        ["Read", "src/stores/agent.ts — 412 lines"],
        ["Edit", "src/components/ui/button.tsx — 2 hunks"],
      ].map(([label, detail], i) => (
        <Collapsible key={label} defaultOpen={i === 0}>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between"
              >
                {label}
                <ChevronDown />
              </Button>
            }
          />
          <CollapsibleContent>
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {detail}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}
