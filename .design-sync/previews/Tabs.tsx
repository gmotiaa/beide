import { Tabs, TabsContent, TabsList, TabsTrigger } from "beide"
import { FileText, Settings, TerminalSquare } from "lucide-react"

export function Default() {
  return (
    <Tabs defaultValue="chat" className="w-80">
      <TabsList>
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="terminal">Terminal</TabsTrigger>
        <TabsTrigger value="diff">Diff</TabsTrigger>
      </TabsList>
      <TabsContent value="chat" className="pt-3 text-sm text-muted-foreground">
        The active trigger sits on a raised surface inside the muted track.
      </TabsContent>
    </Tabs>
  )
}

export function LineVariant() {
  return (
    <Tabs defaultValue="general" className="w-80">
      <TabsList variant="line">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="models">Models</TabsTrigger>
        <TabsTrigger value="mcp">MCP</TabsTrigger>
      </TabsList>
      <TabsContent
        value="general"
        className="pt-3 text-sm text-muted-foreground"
      >
        variant="line" drops the track and the raised surface — used for the
        settings pane.
      </TabsContent>
    </Tabs>
  )
}

export function WithIcons() {
  return (
    <Tabs defaultValue="editor" className="w-80">
      <TabsList>
        <TabsTrigger value="editor">
          <FileText />
          Editor
        </TabsTrigger>
        <TabsTrigger value="terminal">
          <TerminalSquare />
          Terminal
        </TabsTrigger>
        <TabsTrigger value="settings">
          <Settings />
          Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="editor" className="pt-3 text-sm text-muted-foreground">
        Icons resolve to 16px and never shrink.
      </TabsContent>
    </Tabs>
  )
}

export function Vertical() {
  return (
    <Tabs defaultValue="a" orientation="vertical" className="flex gap-4">
      <TabsList className="w-40">
        <TabsTrigger value="a">Permissions</TabsTrigger>
        <TabsTrigger value="b">Checkpoints</TabsTrigger>
        <TabsTrigger value="c">Usage</TabsTrigger>
      </TabsList>
      <TabsContent value="a" className="text-sm text-muted-foreground">
        A vertical orientation stacks the list and left-aligns each trigger.
      </TabsContent>
    </Tabs>
  )
}
