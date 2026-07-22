/** Shared IPC validation helpers for the beide main process. */

export class IpcError extends Error {
  constructor(
    message: string,
    readonly code: string = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "IpcError";
  }
}

export function asString(value: unknown, name: string, max = 10_000): string {
  if (typeof value !== "string") {
    throw new IpcError(`${name} must be a string`, "INVALID_TYPE");
  }
  if (value.length > max) {
    throw new IpcError(`${name} too long (max ${max})`, "TOO_LARGE");
  }
  return value;
}

export function asOptionalString(
  value: unknown,
  name: string,
  max = 10_000,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return asString(value, name, max);
}

export function asBoolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new IpcError(`${name} must be a boolean`, "INVALID_TYPE");
  }
  return value;
}

export function asObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IpcError(`${name} must be an object`, "INVALID_TYPE");
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, name: string, maxItems = 5_000): unknown[] {
  if (!Array.isArray(value)) {
    throw new IpcError(`${name} must be an array`, "INVALID_TYPE");
  }
  if (value.length > maxItems) {
    throw new IpcError(`${name} too many items (max ${maxItems})`, "TOO_LARGE");
  }
  return value;
}

export function asAgentMode(value: unknown): "plan" | "agent" {
  if (value === "plan" || value === "agent") return value;
  throw new IpcError("mode must be plan|agent", "INVALID_MODE");
}

/** Wrap handler so IpcError → structured { ok:false } where useful, else rethrow. */
export function wrapHandler<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof IpcError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      // Normalize path escape etc.
      throw new Error(msg);
    }
  };
}

export const LIMITS = {
  path: 1_024,
  fileContent: 8_000_000, // 8 MB text
  shellCommand: 8_000,
  searchQuery: 200,
  sessionMessages: 2_000,
  sessionMessageChars: 500_000,
  promptText: 200_000,
  images: 8,
  imageDataChars: 6_000_000,
} as const;
