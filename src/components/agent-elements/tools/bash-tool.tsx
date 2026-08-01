import { memo } from "react";
import { useTranslation } from "react-i18next";
import { TextShimmer } from "../text-shimmer";
import type { TimelineStep, StepState } from "../types/timeline";
import { useToolComplete } from "../hooks/use-tool-complete";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
  partToInvocationState,
} from "../utils/tool-adapters";
import { ToolApprovalFooter, type ToolApproval } from "./tool-approval-footer";

function extractCommandSummary(cmd: string): string {
  return cmd
    .split("|")
    .map((s) => s.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
}

export type BashToolTerminalCardProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
  approval?: ToolApproval;
  isError?: boolean;
  errorText?: string;
};

export function BashToolTerminalCard({
  step,
  state,
  onComplete,
  approval,
  isError = false,
  errorText,
}: BashToolTerminalCardProps) {
  const { t } = useTranslation();
  useToolComplete(state === "animating", step.duration, onComplete);
  const isPending = state === "animating";
  const rawCmd = (step.bashCommand ?? step.toolDetail ?? "").trim();
  // Avoid empty "$ " cards when detail was lost on tool end
  const command =
    !rawCmd || rawCmd === "готово" || rawCmd === "ok" || rawCmd === "ошибка"
      ? ""
      : rawCmd;
  const summary = command ? extractCommandSummary(command) : "shell";

  return (
    <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
      <div className="flex items-center justify-between pl-2.5 pr-2 h-7">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {isPending ? (
            <TextShimmer
              as="span"
              duration={1.2}
              className="inline-flex items-center text-xs leading-none h-full m-0 truncate"
            >
              {t("agentElements.bashRunning", { summary })}
            </TextShimmer>
          ) : isError ? (
            <span className="text-xs text-destructive truncate">
              {t("agentElements.bashFailed", { summary })}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground truncate">
              {t("agentElements.bashDone", { summary })}
            </span>
          )}
        </div>
        {isPending && (
          <svg
            className="w-3 h-3 text-muted-foreground animate-spin shrink-0"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="28"
              strokeDashoffset="7"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <div className="border-t border-border px-2.5 py-1.5 font-mono text-[12px] leading-[16px] overflow-hidden bg-background">
        <div className="break-all">
          <span className="text-amber-600 dark:text-amber-400 select-none">
            ${" "}
          </span>
          <span className="text-foreground">
            {command || (
              <span className="text-muted-foreground italic">…</span>
            )}
          </span>
        </div>
        {!isPending && step.bashOutput && (
          <div className="mt-1 text-muted-foreground whitespace-pre-line max-h-[80px] overflow-hidden">
            {step.bashOutput}
          </div>
        )}
        {!isPending && isError && !step.bashOutput && errorText && (
          <div className="mt-1 text-destructive whitespace-pre-line max-h-[80px] overflow-hidden">
            {errorText}
          </div>
        )}
      </div>
      {approval && <ToolApprovalFooter isPending={isPending} {...approval} />}
    </div>
  );
}

export type BashToolProps = {
  part: any;
};

export const BashTool = memo(function BashTool({ part }: BashToolProps) {
  const approval = (part.input?.approval ?? part.args?.approval) as
    | ToolApproval
    | undefined;
  const invocationState = partToInvocationState(part.state);
  const step = mapToolInvocationToStep(part.toolCallId ?? part.id ?? "bash", {
    toolName: "Bash",
    args: part.input ?? part.args ?? {},
    state: invocationState,
    result: part.output ?? part.result,
  });
  const stepState = mapToolStateToStepState(invocationState);
  const noop = () => {};

  return (
    <BashToolTerminalCard
      step={step}
      state={stepState}
      onComplete={noop}
      approval={approval}
      isError={part.state === "output-error"}
      errorText={typeof part.errorText === "string" ? part.errorText : undefined}
    />
  );
});
