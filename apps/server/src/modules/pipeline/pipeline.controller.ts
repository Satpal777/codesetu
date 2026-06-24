import { Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { StartPipelineInputSchema } from "@repo/schemas";
import { inngest, events } from "@repo/inngest";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";

export const PipelineController = {
  /**
   * Kicks off a pipeline run. We don't do the work here — we just emit the
   * event and return immediately. Inngest picks it up and runs the durable
   * idea→deploy workflow in the background.
   */
  async start(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Not authenticated", 401);
      }

      const { idea } = StartPipelineInputSchema.parse(req.body);
      const pipelineId = randomUUID();

      await inngest.send(
        events.pipelineRunRequested.create({ pipelineId, userId: req.user.id, idea })
      );

      res.status(202).json({
        status: "success",
        message: "Pipeline started",
        data: { pipelineId },
      });
    } catch (err) {
      next(err);
    }
  },
};
