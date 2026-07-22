import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  IconFileCode,
  IconTerminal2,
  IconPencil,
} from "@tabler/icons-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { useAgentStore } from "../../stores/agent";
import { cn } from "../../lib/utils";

function DiffLines({ diff }: { diff: string }) {
  return (
    <div className="diff-view font-mono text-[12px] leading-5">
      {diff.split("\n").map((line, i) => {
        let kind: "add" | "del" | "hunk" | "meta" | "ctx" = "ctx";
        if (line.startsWith("+") && !line.startsWith("+++")) kind = "add";
        else if (line.startsWith("-") && !line.startsWith("---")) kind = "del";
        else if (line.startsWith("@@")) kind = "hunk";
        else if (line.startsWith("+++") || line.startsWith("---")) kind = "meta";
        return (
          <div
            key={i}
            className={cn(
              "diff-view__line whitespace-pre-wrap break-all px-3 py-0.5",
              kind === "add" && "diff-view__line--add",
              kind === "del" && "diff-view__line--del",
              kind === "hunk" && "diff-view__line--hunk",
              kind === "meta" && "diff-view__line--meta",
            )}
          >
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}

export function DiffModal() {
  const { t } = useTranslation();
  const permission = useAgentStore((s) => s.permission);
  const respond = useAgentStore((s) => s.respondPermission);

  const kindMeta = useMemo(() => {
    if (!permission) return { label: "", icon: IconPencil };
    if (permission.kind === "write")
      return { label: t("diff.write"), icon: IconFileCode };
    if (permission.kind === "bash")
      return { label: t("diff.bash"), icon: IconTerminal2 };
    return { label: t("diff.edit"), icon: IconPencil };
  }, [permission, t]);

  const open = Boolean(permission);
  const body =
    permission?.diff ||
    permission?.content ||
    permission?.command ||
    "";

  const Icon = kindMeta.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && permission) void respond(false);
      }}
    >
      <DialogContent
        className="diff-dialog gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton
      >
        <DialogHeader className="gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="text-base">{t("diff.title")}</DialogTitle>
            <Badge variant="secondary" className="gap-1 font-normal">
              <Icon className="size-3.5" stroke={1.75} />
              {kindMeta.label}
            </Badge>
          </div>
          {permission?.description ? (
            <DialogDescription className="text-left">
              {permission.description}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              Подтверждение действия агента
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-2 px-4 py-3">
          {permission?.path ? (
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">{t("diff.path")}</span>
              <code className="diff-dialog__code rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                {permission.path}
              </code>
            </div>
          ) : null}
          {permission?.command ? (
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">{t("diff.command")}</span>
              <code className="diff-dialog__code rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px]">
                {permission.command}
              </code>
            </div>
          ) : null}
        </div>

        <Separator />

        <ScrollArea className="max-h-[min(52vh,420px)]">
          {body ? (
            permission?.diff ? (
              <DiffLines diff={permission.diff} />
            ) : (
              <pre className="diff-view whitespace-pre-wrap break-all p-3 font-mono text-[12px] leading-5 text-foreground">
                {body}
              </pre>
            )
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("diff.noDiff")}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-border bg-muted/40 px-4 py-3 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void respond(false)}
          >
            {t("diff.reject")}
          </Button>
          <Button
            type="button"
            onClick={() => void respond(true, permission?.content)}
          >
            {t("diff.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
