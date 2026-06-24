import { z } from "zod";
import { aiConfig } from "./config.js";

/* ------------------------------------------------------------------ *
 * Model catalog — the single source of truth for every model the UI can
 * offer. Pure data, NO secrets, so it's safe to serve to the browser
 * (via GET /api/models). The model id is `provider|model`; the registry
 * resolves it with a "|" separator (NOT ":", because OpenRouter free ids
 * already contain ":" — e.g. `…:free`).
 * ------------------------------------------------------------------ */

export type Provider = "openai" | "anthropic" | "free";
export type Tier = "premium" | "fast" | "free";

export interface ModelInfo {
  id: string;
  label: string;
  provider: Provider;
  tier: Tier;
}

export const MODELS: ModelInfo[] = [
  { id: "anthropic|claude-opus-4-8", label: "Claude Opus 4.8", provider: "anthropic", tier: "premium" },
  { id: "anthropic|claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", tier: "fast" },
  { id: "openai|gpt-4o", label: "GPT-4o", provider: "openai", tier: "premium" },
  { id: "openai|gpt-4o-mini", label: "GPT-4o mini", provider: "openai", tier: "fast" },
  { id: "free|meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B", provider: "free", tier: "free" },
  { id: "free|deepseek/deepseek-r1:free", label: "DeepSeek R1", provider: "free", tier: "free" },
];

export const MODEL_IDS = MODELS.map((m) => m.id);

export const ModelIdSchema = z.enum(MODEL_IDS as [string, ...string[]]);

/** Used when no model is chosen. Latest Claude per house guidance. */
export const DEFAULT_MODEL_ID = "anthropic|claude-opus-4-8";

/** Catalog filtered to providers that actually have a key configured. */
export function availableModels(): ModelInfo[] {
  const enabled: Record<Provider, boolean> = {
    openai: aiConfig.hasOpenAI(),
    anthropic: aiConfig.hasAnthropic(),
    free: aiConfig.hasOpenRouter(),
  };
  return MODELS.filter((m) => enabled[m.provider]);
}
