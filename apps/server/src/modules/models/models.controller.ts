import { Request, Response } from "express";
import { availableModels, DEFAULT_MODEL_ID } from "@repo/ai";
import { PROCESSING_STAGES } from "@repo/inngest";

export const ModelsController = {
  /**
   * The model catalog the UI's picker renders — only providers with a key
   * configured, plus the pipeline's stage list (so per-stage selection stays
   * in sync with what actually runs). Pure metadata, no secrets.
   */
  list(_req: Request, res: Response) {
    const models = availableModels();
    const defaultModelId =
      models.find((m) => m.id === DEFAULT_MODEL_ID)?.id ?? models[0]?.id ?? DEFAULT_MODEL_ID;

    res.status(200).json({
      status: "success",
      data: { models, defaultModelId, stages: PROCESSING_STAGES },
    });
  },
};
