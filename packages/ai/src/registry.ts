import type { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
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
import { availableModels } from "./catalog.js";

let openrouter: OpenRouterProvider | null = null;

function getOpenRouter(): OpenRouterProvider {
  if (!openrouter) openrouter = createOpenRouter({ apiKey: aiConfig.openRouterKey() });
  return openrouter;
}

export function resolveModel(modelId: string): LanguageModel {
  let activeModelId = modelId;
  const sep = activeModelId.indexOf("|");
  if (sep === -1) {
    throw new Error(`Invalid model id (expected "provider|model"): ${activeModelId}`);
  }
  let provider = activeModelId.slice(0, sep);
  let model = activeModelId.slice(sep + 1);

  // Check if provider is enabled
  const enabled: Record<string, boolean> = {
    openai: aiConfig.hasOpenAI(),
    anthropic: aiConfig.hasAnthropic(),
    google: aiConfig.hasGoogle(),
    free: aiConfig.hasOpenRouter(),
  };

  const isEnabled = enabled[provider] ?? false;

  if (!isEnabled) {
    const available = availableModels();
    if (available.length > 0 && available[0]) {
      activeModelId = available[0].id;
      const nextSep = activeModelId.indexOf("|");
      provider = activeModelId.slice(0, nextSep);
      model = activeModelId.slice(nextSep + 1);
    }
  }

  switch (provider) {
    case "openai":
      return openai(model);
    case "anthropic":
      return anthropic(model);
    case "google":
      return google(model);
    case "free":
      return getOpenRouter().chat(model);
    default:
      throw new Error(`Unknown provider "${provider}" in model id: ${activeModelId}`);
  }
}
