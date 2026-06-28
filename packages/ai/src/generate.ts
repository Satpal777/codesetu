import { generateObject, generateText } from "ai";
import type { z } from "zod";
import { resolveModel } from "./registry.js";

/* ------------------------------------------------------------------ *
 * Generation helpers the pipeline stage handlers call. The provider is
 * chosen purely by `modelId` — switch providers by switching the string.
 * ------------------------------------------------------------------ */

/** Generate a Zod-validated structured object (e.g. a PRD, a task list). */
export async function generateStructured<S extends z.ZodType>(
  modelId: string,
  opts: { schema: S; system?: string; prompt: string }
): Promise<z.infer<S>> {
  // OpenRouter free-tier and Cloudflare Workers AI models don't support
  // function-calling tool mode, so fall back to JSON mode.
  const useJsonMode = modelId.startsWith("free|") || modelId.startsWith("cloudflare|");

  const { object } = await generateObject({
    model: resolveModel(modelId),
    schema: opts.schema,
    system: opts.system,
    prompt: opts.prompt,
    ...(useJsonMode ? { mode: "json" as const } : {}),
  });
  return object as z.infer<S>;
}

/** Generate free-form text. */
export async function generateProse(
  modelId: string,
  opts: { system?: string; prompt: string }
): Promise<string> {
  const { text } = await generateText({
    model: resolveModel(modelId),
    system: opts.system,
    prompt: opts.prompt,
  });
  return text;
}
