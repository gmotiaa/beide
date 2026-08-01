/**
 * Rendered preview for markdown tabs. Reuses the chat markdown renderer
 * (agent-elements/markdown.tsx) instead of adding a second markdown stack —
 * hard rule 7 in AGENTS.md.
 */
import { Markdown } from "../agent-elements/markdown";

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="editor-md-preview">
      <div className="editor-md-preview__inner">
        <Markdown content={content} />
      </div>
    </div>
  );
}
