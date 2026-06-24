import type { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { createOpenRouter, type OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import { aiConfig } from "./config.js";

/* ------------------------------------------------------------------ *
 * Model resolver — the one place provider SDKs are wired up. A model id
 * is `provider|model`; we split on the FIRST "|" only, because OpenRouter
 * free ids contain their own ":" (e.g. `free|deepseek/deepseek-r1:free`).
 * Switch providers by switching the string — nothing else changes.
 *
 * Built lazily so OPENROUTER_API_KEY is read after the server's
 * dotenv.config() has run.
 * ------------------------------------------------------------------ */
let openrouter: OpenRouterProvider | null = null;

function getOpenRouter(): OpenRouterProvider {
  if (!openrouter) openrouter = createOpenRouter({ apiKey: aiConfig.openRouterKey() });
  return openrouter;
}

export function resolveModel(modelId: string): LanguageModel {
  const sep = modelId.indexOf("|");
  if (sep === -1) {
    throw new Error(`Invalid model id (expected "provider|model"): ${modelId}`);
  }
  const provider = modelId.slice(0, sep);
  const model = modelId.slice(sep + 1);

  switch (provider) {
    case "openai":
      return openai(model);
    case "anthropic":
      return anthropic(model);
    case "free":
      return getOpenRouter().chat(model);
    default:
      throw new Error(`Unknown provider "${provider}" in model id: ${modelId}`);
  }
}
