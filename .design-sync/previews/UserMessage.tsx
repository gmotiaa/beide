import { UserMessage } from "beide"

export function Short() {
  return (
    <div className="w-96">
      <UserMessage
        message={{
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Wire the diff card into the chat panel." }],
        }}
      />
    </div>
  )
}

export function Multiline() {
  return (
    <div className="w-96">
      <UserMessage
        message={{
          id: "u2",
          role: "user",
          parts: [
            {
              type: "text",
              text: "The resizer swallows the first drag after the terminal opens.\n\nRepro: open the terminal, then drag the vertical gutter — the first pointerdown lands on the panel, not the gutter.",
            },
          ],
        }}
      />
    </div>
  )
}

export function WithAttachment() {
  return (
    <div className="w-96">
      <UserMessage
        enableImagePreview={false}
        message={{
          id: "u3",
          role: "user",
          parts: [
            { type: "text", text: "Match the spacing in this spec." },
            {
              type: "file",
              filename: "spacing-spec.pdf",
              mimeType: "application/pdf",
              size: 184320,
            },
          ],
        }}
      />
    </div>
  )
}
