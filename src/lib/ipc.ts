import type { BeideApi } from "./types";

/** Safe accessor for window.beide — returns null outside Electron preload. */
export function getBeide(): BeideApi | null {
  if (typeof window === "undefined") return null;
  return window.beide ?? null;
}

/** Subscribe to a main→renderer channel; no-op when API missing. */
export function onBeide(
  channel: string,
  listener: (...args: unknown[]) => void,
): () => void {
  const api = getBeide();
  if (!api?.on) return () => undefined;
  return api.on(channel, listener);
}

/** Generate a short unique id for client-side message keys. */
export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
