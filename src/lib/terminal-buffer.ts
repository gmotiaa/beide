/**
 * Bridge between the terminal panel and the chat composer: the panel registers
 * a snapshot getter for its ACTIVE tab, the composer's "@terminal" button
 * reads it. A module-level registry keeps the two components decoupled (no
 * store churn for a value only read on click).
 */
let getter: (() => string) | null = null;

export function registerTerminalSnapshot(fn: (() => string) | null): void {
  getter = fn;
}

/** Last visible lines of the active terminal, "" when none is open. */
export function getTerminalSnapshot(): string {
  try {
    return getter?.() ?? "";
  } catch {
    return "";
  }
}
