/**
 * @repo/ai — provider-agnostic AI layer.
 *
 *   import { generateStructured, MODELS, resolveStageModels } from "@repo/ai";
 *
 * The UI never imports this package; it reads the catalog over HTTP
 * (GET /api/models) so provider SDKs and keys stay server-side.
 */
export {
  MODELS,
  MODEL_IDS,
  ModelIdSchema,
  DEFAULT_MODEL_ID,
  availableModels,
  type ModelInfo,
  type Provider,
  type Tier,
} from "./catalog.js";
export {
  StageModelsInputSchema,
  resolveStageModels,
  type StageModelsInput,
} from "./stage-models.js";
export { generateStructured, generateProse } from "./generate.js";
export { resolveModel } from "./registry.js";
export { aiConfig } from "./config.js";
