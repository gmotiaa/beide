/**
 * Tool state cache for detecting AI SDK in-place mutations.
 * AI SDK mutates objects in-place during streaming, so we must
 * cache state externally and compare cached values.
 */

type CachedToolState = {
  state: string | undefined;
  inputJson: string;
  outputJson: string;
};

/**
 * Cap the cache so long sessions don't accumulate a full JSON copy of every
 * tool call's input/output forever. The Map preserves insertion order, so the
 * first key is always the oldest entry — a cheap LRU.
 */
const TOOL_STATE_CACHE_LIMIT = 300;
const toolStateCache = new Map<string, CachedToolState>();

function setCachedToolState(toolCallId: string, state: CachedToolState): void {
  // Re-inserting moves the key to the tail, keeping actively streaming tools
  // away from the eviction end.
  if (toolStateCache.has(toolCallId)) toolStateCache.delete(toolCallId);
  toolStateCache.set(toolCallId, state);
  if (toolStateCache.size > TOOL_STATE_CACHE_LIMIT) {
    const oldestKey = toolStateCache.keys().next().value;
    if (oldestKey !== undefined) toolStateCache.delete(oldestKey);
  }
}

function getToolStateSnapshot(part: any): CachedToolState {
  return {
    state: part.state,
    inputJson: JSON.stringify(part.input || {}),
    outputJson: JSON.stringify(part.output || {}),
  };
}

function hasToolStateChanged(toolCallId: string, part: any): boolean {
  const cached = toolStateCache.get(toolCallId);
  const current = getToolStateSnapshot(part);

  if (!cached) {
    setCachedToolState(toolCallId, current);
    return true;
  }

  const changed =
    cached.state !== current.state ||
    cached.inputJson !== current.inputJson ||
    cached.outputJson !== current.outputJson;

  if (changed) {
    setCachedToolState(toolCallId, current);
  }

  return changed;
}

function arePartsEqual(prev: any, next: any): boolean {
  if (prev.toolCallId !== next.toolCallId) return false;
  if (prev.type !== next.type) return false;

  const toolCallId = next.toolCallId;
  if (!toolCallId) {
    return prev.state === next.state;
  }

  const changed = hasToolStateChanged(toolCallId, next);
  return !changed;
}

function isToolCompleted(part: any): boolean {
  if (part.output !== undefined && part.output !== null) return true;
  if (part.state === "error") return true;
  if (part.state === "result") return true;
  return false;
}

/** Deep compare function for tool part props. Used with React.memo(). */
export function areToolPropsEqual(
  prevProps: { part: any; chatStatus?: string },
  nextProps: { part: any; chatStatus?: string },
): boolean {
  const partsEqual = arePartsEqual(prevProps.part, nextProps.part);
  if (!partsEqual) return false;
  if (isToolCompleted(nextProps.part)) return true;
  if (prevProps.chatStatus !== nextProps.chatStatus) return false;
  return true;
}

/** Get tool status from part state */
export function getToolStatus(part: any, chatStatus?: string) {
  const basePending =
    part.state !== "output-available" && part.state !== "output-error";
  const isError =
    part.state === "output-error" ||
    (part.state === "output-available" && part.output?.success === false);
  const isSuccess = part.state === "output-available" && !isError;
  const isPending = basePending && chatStatus === "streaming";
  const isInterrupted =
    basePending && chatStatus !== "streaming" && chatStatus !== undefined;

  return { isPending, isError, isSuccess, isInterrupted };
}
