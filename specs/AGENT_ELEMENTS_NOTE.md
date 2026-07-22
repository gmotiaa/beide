# Agent Elements in beide

## Installed
- Components under `src/components/agent-elements/` (from registry `agent-elements.21st.dev`)
- Chat surface wired in `src/components/chat/ChatPanel.tsx` via `<AgentChat />`
- Bridge: `src/lib/to-ui-messages.ts` maps beide `ChatMessage[]` → AI SDK `UIMessage[]`
- Theme: `--an-*` tokens mapped in `src/styles/themes.css` + `agent-ui.css`
- MCP (Cursor): `.cursor/mcp.json` → `REGISTRY_URL=https://agent-elements.21st.dev/r/index.json`

## Electron adaptations
- `spiral-loader.tsx` rewritten without `next/dynamic` / `next-themes` (Vite + lottie-react)
- Dark mode via `document.documentElement.classList.toggle('dark', …)` in settings store

## How chat works
1. User types in Agent Elements `InputBar` (ModeSelector Plan/Agent in leftActions)
2. `onSend` → `useAgentStore.send` → pi SDK in Electron main
3. Streaming events update `useChatStore` messages
4. `toUIMessages` converts flat messages into UIMessage parts (text + tool-Bash/Edit/…)
5. Default `ToolRenderer` paints Bash/Edit/Grep/Read cards

## MCP usage (Cursor / other clients)
```json
{
  "mcpServers": {
    "agent-elements": {
      "command": "npx",
      "args": ["-y", "shadcn@canary", "mcp"],
      "env": {
        "REGISTRY_URL": "https://agent-elements.21st.dev/r/index.json"
      }
    }
  }
}
```
Docs: https://agent-elements.21st.dev/docs/mcp
