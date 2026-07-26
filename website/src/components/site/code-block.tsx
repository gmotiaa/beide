import * as React from "react";
import { Check, Copy } from "lucide-react";

import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  caption,
  className,
}: {
  code: string;
  caption?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the code is still selectable by hand.
    }
  };

  return (
    <div
      className={cn(
        "border-border bg-code-bg group relative overflow-hidden rounded-xl border",
        className
      )}
    >
      {caption ? (
        <div className="border-border text-muted-foreground flex items-center justify-between border-b px-4 py-2 font-mono text-xs">
          <span>{caption}</span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={copy}
        aria-label="Скопировать"
        className="text-muted-foreground hover:text-foreground hover:bg-panel-hover absolute top-2 right-2 rounded-md p-2 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
        style={caption ? { top: "2.6rem" } : undefined}
      >
        {copied ? (
          <Check className="text-success size-4" />
        ) : (
          <Copy className="size-4" />
        )}
      </button>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>
          {code.split("\n").map((line, i) => (
            <span key={i} className="block">
              {line.startsWith("#") || line.startsWith("//") ? (
                <span className="text-faint">{line}</span>
              ) : line.startsWith("-") ? (
                <span className="text-muted-foreground">{line}</span>
              ) : (
                <>
                  <span className="text-primary">
                    {line.split(" ")[0]}
                  </span>
                  <span className="text-foreground/85">
                    {line.slice(line.split(" ")[0].length)}
                  </span>
                </>
              )}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
