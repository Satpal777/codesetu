import { z } from "zod";
import { DEFAULT_MODEL_ID, ModelIdSchema } from "./catalog.js";

/* ------------------------------------------------------------------ *
 * Per-stage model selection. The UI sends a default (applied to every
 * stage) plus optional per-stage overrides; the server resolves that to
 * a concrete { stage -> modelId } map before handing it to the pipeline.
 * Pipeline-agnostic: the stage list is passed in by the caller.
 * ------------------------------------------------------------------ */

export const StageModelsInputSchema = z.object({
  defaultModelId: ModelIdSchema.optional(),
  overrides: z.record(z.string(), ModelIdSchema).optional(),
});

export type StageModelsInput = z.infer<typeof StageModelsInputSchema>;

/** Resolve a default + overrides into a model id for every given stage. */
export function resolveStageModels(
  input: StageModelsInput,
  stages: readonly string[]
): Record<string, string> {
  const fallback = input.defaultModelId ?? DEFAULT_MODEL_ID;
  const overrides = input.overrides ?? {};
  const out: Record<string, string> = {};
  for (const stage of stages) {
    out[stage] = overrides[stage] ?? fallback;
  }
  return out;
}
