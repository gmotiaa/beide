import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "beide";

export function Open() {
  return (
    <div className="w-64 p-4">
      <Label className="mb-1.5 block text-xs text-muted-foreground">Model</Label>
      <Select defaultValue="Claude Opus 5" defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Anthropic</SelectLabel>
            <SelectItem value="Claude Opus 5">Claude Opus 5</SelectItem>
            <SelectItem value="Claude Sonnet 5">Claude Sonnet 5</SelectItem>
            <SelectItem value="Claude Haiku 4.5">Claude Haiku 4.5</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Local</SelectLabel>
            <SelectItem value="Ollama · qwen2.5-coder">Ollama · qwen2.5-coder</SelectItem>
            <SelectItem value="Ollama · llama3.1" disabled>
              Ollama · llama3.1
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function Closed() {
  return (
    <div className="flex w-64 flex-col gap-3">
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Model</Label>
        <Select defaultValue="Claude Opus 5">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Theme</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="System default" />
          </SelectTrigger>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Terminal shell</Label>
        <Select defaultValue="PowerShell" disabled>
          <SelectTrigger disabled>
            <SelectValue />
          </SelectTrigger>
        </Select>
      </div>
    </div>
  );
}
