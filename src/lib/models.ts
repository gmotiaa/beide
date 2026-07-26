/**
 * Single source of truth for the model catalog.
 *
 * The picker in the renderer and the resolver in the main process used to keep
 * two hand-maintained copies of this list, so adding or renaming a model in one
 * place silently left the other pointing at an id the backend could not
 * resolve. Both now import from here.
 */

export type ModelProvider = "anthropic" | "nvidia" | "google" | "xai";

export interface BeideModel {
  /** Exact id sent as `body.model` — never a display alias. */
  id: string;
  /** Short brand name for the picker. */
  name: string;
  /** Version suffix rendered next to the name. */
  version: string;
  provider: ModelProvider;
  /** Whether the model accepts image input. */
  supportsImages: boolean;
  contextWindow: number;
  maxTokens: number;
}

/** OpenAI-compatible endpoint for NVIDIA NIM (same baseURL as the OpenAI SDK). */
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";

export const DEFAULT_MODEL_ID = "minimaxai/minimax-m3";

export const MODEL_CATALOG: BeideModel[] = [
  // Anthropic runs on the credentials pi already holds in ~/.pi/agent/auth.json
  // (Claude Pro/Max OAuth or ANTHROPIC_API_KEY) — beide never stores its own.
  {
    id: "claude-opus-5",
    name: "Claude Opus",
    version: "5",
    provider: "anthropic",
    supportsImages: true,
    contextWindow: 1_000_000,
    maxTokens: 128_000,
  },
  {
    id: "claude-sonnet-5",
    name: "Claude Sonnet",
    version: "5",
    provider: "anthropic",
    supportsImages: true,
    contextWindow: 1_000_000,
    maxTokens: 128_000,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku",
    version: "4.5",
    provider: "anthropic",
    supportsImages: true,
    contextWindow: 200_000,
    maxTokens: 64_000,
  },
  {
    id: "z-ai/glm-5.2",
    name: "GLM",
    version: "5.2",
    provider: "nvidia",
    supportsImages: false,
    contextWindow: 128_000,
    maxTokens: 16_384,
  },
  {
    id: "minimaxai/minimax-m3",
    name: "MiniMax",
    version: "M3",
    provider: "nvidia",
    supportsImages: true,
    contextWindow: 128_000,
    maxTokens: 16_384,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    name: "Nemotron",
    version: "3 Ultra",
    provider: "nvidia",
    supportsImages: false,
    contextWindow: 128_000,
    maxTokens: 16_384,
  },
  {
    id: "moonshotai/kimi-k2.6",
    name: "Kimi",
    version: "K2.6",
    provider: "nvidia",
    supportsImages: true,
    contextWindow: 128_000,
    maxTokens: 16_384,
  },
  {
    id: "deepseek-ai/deepseek-v4-pro",
    name: "DeepSeek",
    version: "V4 Pro",
    provider: "nvidia",
    supportsImages: false,
    contextWindow: 128_000,
    maxTokens: 16_384,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini",
    version: "3.5 Flash",
    provider: "google",
    supportsImages: true,
    contextWindow: 1_000_000,
    maxTokens: 8_192,
  },
  {
    id: "grok-4.5",
    name: "Grok",
    version: "4.5",
    provider: "xai",
    supportsImages: false,
    contextWindow: 256_000,
    maxTokens: 16_384,
  },
];

const BY_ID = new Map(MODEL_CATALOG.map((m) => [m.id, m]));

/** Resolve a picker id, tolerating a `provider/` prefix (e.g. `xai/grok-4.5`). */
export function findModel(id: string): BeideModel | undefined {
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  const direct = BY_ID.get(trimmed);
  if (direct) return direct;
  return MODEL_CATALOG.find((m) => `${m.provider}/${m.id}` === trimmed);
}

/** Display list for the model picker. */
export const MODEL_OPTIONS = MODEL_CATALOG.map(({ id, name, version }) => ({
  id,
  name,
  version,
}));
