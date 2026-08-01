import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineStep, StepState } from "../types/timeline";
import { useToolComplete } from "../hooks/use-tool-complete";
import { SpiralLoader } from "../spiral-loader";
import { ToolRowBase } from "./tool-row-base";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
  partToInvocationState,
} from "../utils/tool-adapters";

export type ThinkingCollapsedProps = {
  step: Extract<TimelineStep, { type: "tool-call" }>;
  state: StepState;
  onComplete: () => void;
  defaultOpen?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export function ThinkingCollapsed({
  step,
  state,
  onComplete,
  defaultOpen,
  expanded,
  onToggleExpand,
}: ThinkingCollapsedProps) {
  const { t } = useTranslation();
  useToolComplete(state === "animating", step.duration, onComplete);

  return (
    <ToolRowBase
      icon={state === "animating" ? <SpiralLoader size={12} /> : undefined}
      shimmerLabel={t("agentElements.thinkingRunning")}
      completeLabel={t("agentElements.thinkingDone")}
      isAnimating={state === "animating"}
      expandable={!!step.thoughtContent}
      defaultOpen={defaultOpen}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    >
      <div className="max-h-[175px] overflow-y-auto">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {step.thoughtContent}
        </p>
      </div>
    </ToolRowBase>
  );
}

export type ThinkingToolProps = {
  part?: any;
  step?: Extract<TimelineStep, { type: "tool-call" }>;
  state?: StepState;
  onComplete?: () => void;
  defaultOpen?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export const ThinkingTool = memo(function ThinkingTool({
  part,
  step: externalStep,
  state: externalState,
  onComplete: externalOnComplete,
  defaultOpen,
  expanded,
  onToggleExpand,
}: ThinkingToolProps) {
  let step: Extract<TimelineStep, { type: "tool-call" }>;
  let stepState: StepState;
  let onComplete: () => void;

  if (externalStep && externalState && externalOnComplete) {
    step = externalStep;
    stepState = externalState;
    onComplete = externalOnComplete;
  } else if (part) {
    const invocationState = partToInvocationState(part.state);
    step = mapToolInvocationToStep(part.toolCallId ?? part.id ?? "thinking", {
      toolName: "Thinking",
      args: part.input ?? part.args ?? {},
      state: invocationState,
      result: part.output ?? part.result,
    });
    stepState = mapToolStateToStepState(invocationState);
    onComplete = () => {};
  } else {
    return null;
  }

  return (
    <ThinkingCollapsed
      step={step}
      state={stepState}
      onComplete={onComplete}
      defaultOpen={defaultOpen}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
  );
});
