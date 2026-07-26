/** Shared IPC validation helpers for the beide main process. */

import type { ChatMessage } from "../../src/lib/types";

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

const VALID_ROLES = new Set(["user", "assistant", "system", "tool"]);

/** Renderer already strips big blobs (compactForSave); this is the disk-side backstop. */
const MAX_TOOL_JSON_CHARS = 200_000;

function capJsonSize<T>(value: T): T | undefined {
  try {
    const json = JSON.stringify(value);
    if (json === undefined || json.length > MAX_TOOL_JSON_CHARS) return undefined;
    return value;
  } catch {
    return undefined; // circular / non-serializable — would fail the whole save later
  }
}

function sanitizeImages(raw: unknown[]): ChatMessage["images"] {
  const out: NonNullable<ChatMessage["images"]> = [];
  for (const item of raw) {
    if (out.length >= LIMITS.images) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.mimeType !== "string" || o.mimeType.length > 64) continue;
    if (typeof o.data !== "string" || o.data.length > LIMITS.imageDataChars) continue;
    const img: NonNullable<ChatMessage["images"]>[number] = {
      mimeType: o.mimeType,
      data: o.data,
    };
    if (typeof o.name === "string") img.name = o.name.slice(0, 255);
    out.push(img);
  }
  return out.length ? out : undefined;
}

function sanitizeMentions(raw: unknown[]): ChatMessage["mentions"] {
  const out: NonNullable<ChatMessage["mentions"]> = [];
  for (const item of raw) {
    if (out.length >= 12) break;
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "file" && o.type !== "folder") continue;
    if (typeof o.path !== "string" || o.path.length > LIMITS.path) continue;
    if (typeof o.name !== "string") continue;
    out.push({ type: o.type, path: o.path, name: o.name.slice(0, 255) });
  }
  return out.length ? out : undefined;
}

export function asChatMessages(value: unknown, name: string, maxItems = 2_000): ChatMessage[] {
  const arr = asArray(value, name, maxItems);
  const out: ChatMessage[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new IpcError(`${name}[${i}] must be an object`, "INVALID_TYPE");
    }
    const obj = item as Record<string, unknown>;
    const role = obj.role;
    if (typeof role !== "string" || !VALID_ROLES.has(role)) {
      throw new IpcError(`${name}[${i}].role must be a valid role`, "INVALID_TYPE");
    }
    const id = obj.id;
    if (typeof id !== "string" || id.length > 128) {
      throw new IpcError(`${name}[${i}].id must be a string (max 128)`, "INVALID_TYPE");
    }
    const content = obj.content;
    if (typeof content !== "string") {
      throw new IpcError(`${name}[${i}].content must be a string`, "INVALID_TYPE");
    }
    if (content.length > LIMITS.sessionMessageChars) {
      throw new IpcError(`${name}[${i}].content too long`, "TOO_LARGE");
    }
    const msg: ChatMessage = {
      id,
      role: role as ChatMessage["role"],
      content,
      createdAt: typeof obj.createdAt === "number" ? obj.createdAt : Date.now(),
    };
    // Optional fields are validated softly: a malformed entry is dropped, not
    // thrown — a throw here fails the whole save and silently loses the
    // transcript. Only the size caps guard the disk.
    if (typeof obj.streaming === "boolean") msg.streaming = obj.streaming;
    if (typeof obj.toolName === "string") msg.toolName = obj.toolName.slice(0, 256);
    if (obj.toolStatus === "running" || obj.toolStatus === "done" || obj.toolStatus === "error") {
      msg.toolStatus = obj.toolStatus;
    }
    if (typeof obj.toolDetail === "string") {
      msg.toolDetail = obj.toolDetail.slice(0, 10_000);
    }
    if (obj.toolArgs && typeof obj.toolArgs === "object" && !Array.isArray(obj.toolArgs)) {
      msg.toolArgs = capJsonSize(obj.toolArgs as Record<string, unknown>);
    }
    if (obj.toolResult !== undefined) msg.toolResult = capJsonSize(obj.toolResult);
    if (Array.isArray(obj.images)) msg.images = sanitizeImages(obj.images);
    if (Array.isArray(obj.mentions)) msg.mentions = sanitizeMentions(obj.mentions);
    out.push(msg);
  }
  return out;
}
