import { generateObject, generateText } from "ai";
import type { ModelMessage } from "ai";
import type { z } from "zod";
import { resolveModel } from "./registry.js";

/* ------------------------------------------------------------------ *
 * Generation helpers the pipeline stage handlers call. The provider is
 * chosen purely by `modelId` — switch providers by switching the string.
 * ------------------------------------------------------------------ */

function buildMessages(system: string | undefined, prompt: string): ModelMessage[] {
  const msgs: ModelMessage[] = [];
  if (system) msgs.push({ role: "system", content: system });
  msgs.push({ role: "user", content: prompt });
  return msgs;
}

/** Generate a Zod-validated structured object (e.g. a PRD, a task list). */
export async function generateStructured<S extends z.ZodType>(
  modelId: string,
  opts: { schema: S; system?: string; prompt: string }
): Promise<z.infer<S>> {
  // AI SDK v6 auto-negotiates the structured-output strategy per provider,
  // so the old `mode: "json"` fallback for OpenRouter free-tier / Cloudflare
  // Workers AI is no longer needed (or accepted).
  const { object } = await generateObject({
    model: resolveModel(modelId),
    schema: opts.schema,
    messages: buildMessages(opts.system, opts.prompt),
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
    messages: buildMessages(opts.system, opts.prompt),
  });
  return text;
}
