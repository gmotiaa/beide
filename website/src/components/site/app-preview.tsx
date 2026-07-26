import { Check, ChevronRight, FileCode2, Folder, X } from "lucide-react";

import { cn } from "@/lib/utils";

const TREE = [
  { name: "electron", kind: "dir", depth: 0 },
  { name: "services", kind: "dir", depth: 1 },
  { name: "agent.ts", kind: "file", depth: 2, active: true },
  { name: "checkpoints.ts", kind: "file", depth: 2 },
  { name: "src", kind: "dir", depth: 0 },
  { name: "stores", kind: "dir", depth: 1 },
  { name: "chat.ts", kind: "file", depth: 2 },
  { name: "BEIDE.md", kind: "file", depth: 0 },
] as const;

const DIFF = [
  { sign: " ", text: "async function applyEdit(path: string, next: string) {" },
  { sign: "-", text: "  await fs.writeFile(path, next, 'utf8');" },
  { sign: "+", text: "  const approved = await requestPermission(path);" },
  { sign: "+", text: "  if (!approved) return { applied: false };" },
  { sign: "+", text: "  await checkpoints.snapshot(path);" },
  { sign: "+", text: "  await fs.writeFile(path, next, 'utf8');" },
  { sign: " ", text: "  return { applied: true };" },
  { sign: " ", text: "}" },
];

export function AppPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-border bg-surface overflow-hidden rounded-xl border shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]",
        className
      )}
    >
      {/* title bar */}
      <div className="border-border bg-panel flex h-9 items-center gap-2 border-b px-3">
        <span className="bg-destructive/80 size-2.5 rounded-full" />
        <span className="bg-warning/80 size-2.5 rounded-full" />
        <span className="bg-success/80 size-2.5 rounded-full" />
        <span className="text-faint ml-3 font-mono text-[11px]">
          beide — ~/projects/beide
        </span>
      </div>

      <div className="grid grid-cols-[128px_1fr] sm:grid-cols-[168px_1fr_248px]">
        {/* file tree */}
        <aside className="border-border bg-surface hidden flex-col gap-0.5 border-r p-2 sm:flex">
          {TREE.map((node) => (
            <div
              key={`${node.depth}-${node.name}`}
              className={cn(
                "flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px]",
                "active" in node && node.active
                  ? "bg-panel-hover text-foreground"
                  : "text-muted-foreground"
              )}
              style={{ paddingLeft: `${6 + node.depth * 11}px` }}
            >
              {node.kind === "dir" ? (
                <Folder className="text-faint size-3" />
              ) : (
                <FileCode2 className="text-faint size-3" />
              )}
              <span className="truncate font-mono">{node.name}</span>
            </div>
          ))}
        </aside>

        {/* editor with a pending diff */}
        <main className="bg-code-bg min-w-0">
          <div className="border-border flex items-center gap-2 border-b px-3 py-1.5">
            <span className="bg-panel-hover text-foreground rounded px-2 py-1 font-mono text-[11px]">
              agent.ts
            </span>
            <span className="text-faint font-mono text-[11px]">chat.ts</span>
          </div>

          <div className="overflow-x-auto p-3">
            <pre className="font-mono text-[11px] leading-[1.7]">
              {DIFF.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "-mx-3 px-3",
                    line.sign === "+" && "bg-success/10 text-success",
                    line.sign === "-" && "bg-destructive/10 text-destructive",
                    line.sign === " " && "text-muted-foreground"
                  )}
                >
                  <span className="text-faint mr-2 inline-block w-3 select-none">
                    {line.sign === " " ? "" : line.sign}
                  </span>
                  {line.text}
                </div>
              ))}
            </pre>
          </div>

          <div className="border-border flex items-center gap-2 border-t px-3 py-2">
            <span className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium">
              <Check className="size-3" />
              Apply
            </span>
            <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px]">
              <X className="size-3" />
              Reject
            </span>
            <span className="text-faint ml-auto font-mono text-[10px]">
              checkpoint · 14:02
            </span>
          </div>
        </main>

        {/* agent panel */}
        <aside className="border-border bg-surface hidden flex-col border-l sm:flex">
          <div className="border-border flex items-center justify-between border-b px-3 py-2">
            <span className="text-foreground text-[11px] font-medium">
              Агент
            </span>
            <span className="border-primary/30 bg-primary/10 text-primary-bright rounded-full border px-2 py-0.5 font-mono text-[10px]">
              Agent
            </span>
          </div>

          <div className="flex flex-col gap-3 p-3">
            <div className="bg-panel border-border rounded-lg border p-2.5">
              <p className="text-foreground/90 text-[11px] leading-relaxed">
                Запись в файл идёт мимо разрешений. Почини{" "}
                <span className="text-primary font-mono">@agent.ts</span>
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              {[
                "Read electron/services/agent.ts",
                "Grep requestPermission",
                "Edit electron/services/agent.ts",
              ].map((tool) => (
                <div
                  key={tool}
                  className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]"
                >
                  <ChevronRight className="text-primary size-3" />
                  <span className="truncate">{tool}</span>
                </div>
              ))}
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Добавил запрос разрешения и снимок чекпоинта перед записью. Дифф
              открыт в редакторе.
            </p>
          </div>

          <div className="border-border mt-auto border-t p-2.5">
            <div className="border-border bg-panel text-faint rounded-md border px-2.5 py-2 text-[11px]">
              Спросить или дать задачу…
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
