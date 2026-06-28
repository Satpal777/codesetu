import { z } from "zod";
import { aiConfig } from "./config.js";

/* ------------------------------------------------------------------ *
 * Model catalog — the single source of truth for every model the UI can
 * offer. Pure data, NO secrets, so it's safe to serve to the browser
 * (via GET /api/models). The model id is `provider|model`; the registry
 * resolves it with a "|" separator (NOT ":", because OpenRouter free ids
 * already contain ":" — e.g. `…:free`).
 * ------------------------------------------------------------------ */

export type Provider = "openai" | "anthropic" | "google" | "free";
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
  { id: "google|gemini-3.5-flash", label: "Gemini 3.5 Flash", provider: "google", tier: "free" },
  { id: "google|gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", tier: "free" },
  { id: "google|gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", tier: "free" },
  { id: "free|openai/gpt-oss-120b", label: "GPT-OSS 120B", provider: "free", tier: "free" },
  { id: "free|openai/gpt-oss-20b", label: "GPT-OSS 20B", provider: "free", tier: "free" },
  { id: "free|nvidia/nemotron-3-nano-30b-a3b", label: "Nemotron 3 Nano 30B", provider: "free", tier: "free" },
  { id: "free|nvidia/nemotron-3-super-120b", label: "Nemotron 3 Super", provider: "free", tier: "free" },
  { id: "free|stepfun/step-3.5-flash", label: "Step 3.5 Flash", provider: "free", tier: "free" },
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
    google: aiConfig.hasGoogle(),
    free: aiConfig.hasOpenRouter(),
  };
  return MODELS.filter((m) => enabled[m.provider]);
}
