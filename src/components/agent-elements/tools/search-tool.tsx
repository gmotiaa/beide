import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineStep, StepState } from "../types/timeline";
import type { SourceType } from "../icons/source-icons";
import { IconFileText } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { useToolComplete } from "../hooks/use-tool-complete";
import {
  mapToolInvocationToStep,
  mapToolStateToStepState,
  partToInvocationState,
} from "../utils/tool-adapters";
import { cn } from "../utils/cn";

export type SearchResult = { source: SourceType; title: string; date: string };

export type SearchGroupRichProps = {
  toolSteps: Extract<TimelineStep, { type: "tool-call" }>[];
  stepStates: Record<string, StepState>;
  onStepComplete: (id: string) => void;
  results?: SearchResult[];
  defaultOpen?: boolean;
  /** File-match count from a code search result (grep/glob), when known. */
  matchCount?: number;
  isError?: boolean;
};

export function SearchGroupRich({
  toolSteps,
  stepStates,
  onStepComplete,
  results = [],
  defaultOpen,
  matchCount,
  isError = false,
}: SearchGroupRichProps) {
  const { t } = useTranslation();
  const anyAnimating = toolSteps.some((s) => stepStates[s.id] === "animating");
  const searchQuery = toolSteps.find((s) => s.searchQuery)?.searchQuery ?? "";
  const totalResults = results.length;
  // Only expose the expand affordance once there is something useful to show.
  // While the search is still streaming we have no results yet and the panel
  // header is just "Searched for <same query>" — redundant with the row
  // label. Once results arrive the panel becomes meaningful.
  const hasExpandableContent = totalResults > 0;

  // beide's grep/glob results are not web-search shaped, so `results` is
  // usually empty — "Found 0 results" for a grep that matched plenty was a
  // lie. Prefer the rich-result count, then the code-search file count, then
  // a neutral "done" label.
  const completeLabel = isError
    ? t("agentElements.searchFailed")
    : totalResults > 0
      ? t("agentElements.searchFoundResults", { count: totalResults })
      : typeof matchCount === "number"
        ? t("agentElements.searchFoundFiles", { count: matchCount })
        : t("agentElements.searchDone");

  function CompleteTracker({
    step,
  }: {
    step: Extract<TimelineStep, { type: "tool-call" }>;
  }) {
    useToolComplete(stepStates[step.id] === "animating", step.duration, () =>
      onStepComplete(step.id),
    );
    return null;
  }

  return (
    <>
      {toolSteps.map((step) => (
        <CompleteTracker key={step.id} step={step} />
      ))}
      <ToolRowBase
        shimmerLabel={t("agentElements.searchRunning")}
        completeLabel={completeLabel}
        isAnimating={anyAnimating}
        detail={searchQuery || undefined}
        expandable={hasExpandableContent}
        defaultOpen={defaultOpen}
      >
        <div className="rounded-an-tool-border-radius overflow-hidden bg-an-tool-background border border-border">
          <div className="flex items-center px-2.5 py-0 border-b border-an-tool-border-color h-7 text-xs gap-1">
            <span className="text-foreground font-medium">
              {t("agentElements.searchedFor")}
            </span>{" "}
            <span className="text-muted-foreground truncate">
              &ldquo;{searchQuery}&rdquo;
            </span>
          </div>
          <div className="max-h-[200px] overflow-y-auto bg-background">
            <div className="flex flex-col gap-1 p-1">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1 rounded-[calc(var(--an-tool-border-radius)-4px)] cursor-default",
                    "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center justify-center w-4 h-4 shrink-0 text-muted-foreground">
                    <IconFileText className="w-4 h-4" />
                  </div>
                  <span className="text-sm text-foreground/90 truncate flex-1 min-w-0">
                    {result.title}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {result.date || result.source}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ToolRowBase>
    </>
  );
}

export type SearchToolProps = {
  part: {
    id?: string;
    toolCallId?: string;
    type?: string;
    state?: string;
    input?: Record<string, unknown>;
    args?: Record<string, unknown>;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  results?: SearchResult[];
  defaultOpen?: boolean;
};

function normalizeResults(value: unknown): SearchResult[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const source = (item as { source?: unknown }).source;
      const title = (item as { title?: unknown }).title;
      const date = (item as { date?: unknown }).date;
      if (
        typeof source !== "string" ||
        typeof title !== "string" ||
        typeof date !== "string"
      ) {
        return null;
      }
      return { source: source as SourceType, title, date };
    })
    .filter((item): item is SearchResult => Boolean(item));
  return parsed.length > 0 ? parsed : undefined;
}

function pickMatchCount(part: SearchToolProps["part"]): number | undefined {
  const candidates = [
    part.output?.numFiles,
    part.result?.numFiles,
    (part.output?.details as { entries?: unknown } | undefined)?.entries,
  ];
  for (const v of candidates) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  }
  return undefined;
}

export const SearchTool = memo(function SearchTool({
  part,
  results,
  defaultOpen,
}: SearchToolProps) {
  const invocationState = partToInvocationState(part.state);
  const step = mapToolInvocationToStep(part.toolCallId ?? part.id ?? "search", {
    toolName: part.type?.replace("tool-", "") || "WebSearch",
    args: part.input ?? part.args ?? {},
    state: invocationState,
    result: part.output ?? part.result,
  });
  const stepState = mapToolStateToStepState(invocationState);
  const stepStates = { [step.id]: stepState };
  const noop = () => {};

  return (
    <SearchGroupRich
      toolSteps={[step]}
      stepStates={stepStates}
      onStepComplete={noop}
      results={
        results ??
        normalizeResults(part.output?.results) ??
        normalizeResults(part.result?.results)
      }
      matchCount={pickMatchCount(part)}
      isError={part.state === "output-error"}
      defaultOpen={defaultOpen}
    />
  );
});
