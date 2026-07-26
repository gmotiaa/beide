import { McpTool } from "beide"

const info = {
  serverName: "supabase",
  toolName: "list_tables",
  displayName: "List tables",
  category: "database",
}

export function Complete() {
  return (
    <div className="w-96">
      <McpTool
        part={{
          type: "tool-mcp__supabase__list_tables",
          toolCallId: "m1",
          state: "output-available",
          input: { schema: "public" },
          output: [{ type: "text", text: '["sessions","usage","settings"]' }],
        }}
        mcpInfo={info}
        chatStatus="ready"
      />
    </div>
  )
}

export function Expanded() {
  return (
    <div className="w-96">
      <McpTool
        part={{
          type: "tool-mcp__supabase__list_tables",
          toolCallId: "m2",
          state: "output-available",
          input: { schema: "public" },
          output: [{ type: "text", text: '["sessions","usage","settings"]' }],
        }}
        mcpInfo={info}
        chatStatus="ready"
        defaultOpen
      />
    </div>
  )
}

export function Running() {
  return (
    <div className="w-96">
      <McpTool
        part={{
          type: "tool-mcp__supabase__search_docs",
          toolCallId: "m3",
          state: "input-available",
          input: { query: "row level security policies" },
        }}
        mcpInfo={{
          serverName: "supabase",
          toolName: "search_docs",
          displayName: "Search docs",
          category: "docs",
        }}
        chatStatus="streaming"
      />
    </div>
  )
}
