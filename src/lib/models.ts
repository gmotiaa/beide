/**
 * Single source of truth for the model catalog.
 *
 * The gateway is OpenAI-compatible, so picker ids are sent to its API verbatim.
 * Metadata (context, max output, image input) mirrors what the gateway's
 * /v1/models reported on 2026-08-01 — update it from there, don't guess.
 */

export type ModelProvider = "echogate";

/** Model author shown as a group header in the picker. */
export type ModelVendor =
  | "openai"
  | "anthropic"
  | "google"
  | "xai"
  | "deepseek"
  | "alibaba"
  | "moonshot"
  | "zhipu"
  | "minimax";

export const VENDOR_LABELS: Record<ModelVendor, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  xai: "xAI",
  deepseek: "DeepSeek",
  alibaba: "Alibaba",
  moonshot: "Moonshot",
  zhipu: "Zhipu",
  minimax: "MiniMax",
};

export interface BeideModel {
  /** Exact id sent as `body.model` — never a display alias. */
  id: string;
  /** Short brand name for the picker. */
  name: string;
  /** Version suffix rendered next to the name. */
  version: string;
  vendor: ModelVendor;
  provider: ModelProvider;
  /** From the gateway's input_modalities. */
  supportsImages: boolean;
  contextWindow: number;
  maxTokens: number;
  /** Listed by the gateway but currently erroring — greyed out in the picker. */
  disabled?: boolean;
}

/** OpenAI-compatible endpoint documented by the gateway. */
export const ECHOGATE_BASE_URL = "https://api.echogate.one/v1";
export const DEFAULT_MODEL_ID = "gpt-5.6-terra";

const P = { provider: "echogate" as const };
// The gateway advertises up to 500k output tokens; cap requests at something
// an IDE turn can actually use so a runaway generation cannot eat a quota.
const MAX_OUTPUT_CAP = 131_072;
const out = (reported: number) => Math.min(reported, MAX_OUTPUT_CAP);

// Ordered by vendor (group order in the picker), newest first within a vendor. This is the
// gateway's full /v1/models list; `disabled` marks entries the gateway lists
// but which currently error on completion (verified by hand — re-check before
// flipping them back on).
export const MODEL_CATALOG: BeideModel[] = [
  { id: "gpt-5.6-sol", name: "GPT", version: "5.6 Sol", vendor: "openai", supportsImages: true, contextWindow: 1_050_000, maxTokens: out(128_000), ...P },
  { id: "gpt-5.6-terra", name: "GPT", version: "5.6 Terra", vendor: "openai", supportsImages: true, contextWindow: 1_050_000, maxTokens: out(128_000), ...P },
  { id: "gpt-5.6-luna", name: "GPT", version: "5.6 Luna", vendor: "openai", supportsImages: true, contextWindow: 1_050_000, maxTokens: out(128_000), ...P },
  { id: "gpt-5.5-pro", name: "GPT", version: "5.5 Pro", vendor: "openai", supportsImages: false, contextWindow: 1_050_000, maxTokens: out(128_000), ...P },
  { id: "gpt-5.5", name: "GPT", version: "5.5", vendor: "openai", supportsImages: true, contextWindow: 1_050_000, maxTokens: out(128_000), ...P },
  { id: "claude-fable-5", name: "Claude Fable", version: "5", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(128_000), ...P },
  { id: "claude-opus-5", name: "Claude Opus", version: "5", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(128_000), disabled: true, ...P },
  { id: "claude-sonnet-5", name: "Claude Sonnet", version: "5", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(128_000), ...P },
  { id: "claude-opus-4-8", name: "Claude Opus", version: "4.8", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(128_000), ...P },
  { id: "claude-opus-4-7", name: "Claude Opus", version: "4.7", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(128_000), ...P },
  { id: "claude-opus-4-6", name: "Claude Opus", version: "4.6", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(128_000), ...P },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet", version: "4.6", vendor: "anthropic", supportsImages: true, contextWindow: 1_000_000, maxTokens: out(64_000), ...P },
  { id: "gemini-3.6-flash", name: "Gemini", version: "3.6 Flash", vendor: "google", supportsImages: true, contextWindow: 1_048_576, maxTokens: out(65_536), ...P },
  { id: "gemini-3.5-flash", name: "Gemini", version: "3.5 Flash", vendor: "google", supportsImages: true, contextWindow: 1_048_576, maxTokens: out(65_536), ...P },
  { id: "gemini-3.1-pro-preview", name: "Gemini", version: "3.1 Pro Preview", vendor: "google", supportsImages: true, contextWindow: 1_048_576, maxTokens: out(65_536), ...P },
  { id: "gemini-3.1-flash-lite", name: "Gemini", version: "3.1 Flash Lite", vendor: "google", supportsImages: true, contextWindow: 1_048_576, maxTokens: out(65_536), ...P },
  { id: "gemini-2.5-pro", name: "Gemini", version: "2.5 Pro", vendor: "google", supportsImages: true, contextWindow: 1_050_000, maxTokens: out(65_500), ...P },
  { id: "gemini-2.5-flash", name: "Gemini", version: "2.5 Flash", vendor: "google", supportsImages: true, contextWindow: 1_050_000, maxTokens: out(65_500), ...P },
  { id: "grok-4.5", name: "Grok", version: "4.5", vendor: "xai", supportsImages: false, contextWindow: 500_000, maxTokens: out(500_000), ...P },
  { id: "grok-build-0.1", name: "Grok", version: "Build 0.1", vendor: "xai", supportsImages: false, contextWindow: 256_000, maxTokens: out(256_000), ...P },
  { id: "deepseek-v4-pro", name: "DeepSeek", version: "V4 Pro", vendor: "deepseek", supportsImages: false, contextWindow: 1_000_000, maxTokens: out(384_000), ...P },
  { id: "deepseek-v4-flash", name: "DeepSeek", version: "V4 Flash", vendor: "deepseek", supportsImages: false, contextWindow: 1_000_000, maxTokens: out(384_000), ...P },
  { id: "deepseek-v3.1", name: "DeepSeek", version: "V3.1", vendor: "deepseek", supportsImages: false, contextWindow: 1_000_000, maxTokens: out(384_000), ...P },
  { id: "qwen-3.7-plus", name: "Qwen", version: "3.7 Plus", vendor: "alibaba", supportsImages: true, contextWindow: 991_000, maxTokens: out(64_000), ...P },
  { id: "qwen-3.6-plus", name: "Qwen", version: "3.6 Plus", vendor: "alibaba", supportsImages: false, contextWindow: 262_144, maxTokens: out(65_536), ...P },
  { id: "kimi-k3", name: "Kimi", version: "K3", vendor: "moonshot", supportsImages: true, contextWindow: 1_048_576, maxTokens: out(131_072), disabled: true, ...P },
  { id: "kimi-k2.7-code", name: "Kimi", version: "K2.7 Code", vendor: "moonshot", supportsImages: true, contextWindow: 262_144, maxTokens: out(262_144), ...P },
  { id: "kimi-k2.6", name: "Kimi", version: "K2.6", vendor: "moonshot", supportsImages: true, contextWindow: 262_144, maxTokens: out(65_536), ...P },
  { id: "glm-5.2", name: "GLM", version: "5.2", vendor: "zhipu", supportsImages: false, contextWindow: 1_000_000, maxTokens: out(131_072), ...P },
  { id: "glm-5.1", name: "GLM", version: "5.1", vendor: "zhipu", supportsImages: false, contextWindow: 204_800, maxTokens: out(131_072), ...P },
  { id: "minimax-m3", name: "MiniMax", version: "M3", vendor: "minimax", supportsImages: false, contextWindow: 512_000, maxTokens: out(128_000), ...P },
  { id: "minimax-m2.7", name: "MiniMax", version: "M2.7", vendor: "minimax", supportsImages: false, contextWindow: 204_800, maxTokens: out(131_072), ...P },
  { id: "minimax-m2.5", name: "MiniMax", version: "M2.5", vendor: "minimax", supportsImages: false, contextWindow: 204_800, maxTokens: out(131_072), ...P },
];

const BY_ID = new Map(MODEL_CATALOG.map((model) => [model.id, model]));

/** Resolve a picker id, tolerating the `echogate/` prefix. */
export function findModel(id: string): BeideModel | undefined {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  return BY_ID.get(trimmed) ?? BY_ID.get(trimmed.replace(/^echogate\//, ""));
}

/** Display list for the model picker. */
export const MODEL_OPTIONS: Array<
  Pick<BeideModel, "id" | "name" | "version" | "vendor" | "disabled">
> = MODEL_CATALOG.map(({ id, name, version, vendor, disabled }) => ({
  id,
  name,
  version,
  vendor,
  disabled,
}));
