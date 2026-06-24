import { DEFAULT_MODEL_ID } from "@repo/ai";
import { inngest } from "../client.js";
import { events, PROCESSING_STAGES, type ProcessingStage } from "../events.js";
import { stageHandlers, type StageContext } from "./pipeline.stages.js";

/* ------------------------------------------------------------------ *
 * The Codesetu pipeline orchestrator.
 *
 * Idea → Document → Tasks → Code → Review → Deploy, run as a single
 * durable function. Each stage is wrapped in `step.run`, so:
 *   • a stage that throws is retried on its own (up to `retries`),
 *   • a stage that already succeeded is NEVER re-run, even if a later
 *     stage fails and the function is retried,
 *   • the whole thing survives process restarts and deploys.
 *
 * After each stage we emit `pipeline/stage.completed` so other systems
 * (e.g. a live progress UI) can react without coupling to this function.
 * ------------------------------------------------------------------ */
export const runPipeline = inngest.createFunction(
  {
    id: "run-pipeline",
    name: "Run Codesetu pipeline",
    retries: 3,
    triggers: [{ event: events.pipelineRunRequested }],
    // Surfaced after all retries are exhausted — emit a failure event so the
    // rest of the system can mark the run as failed and notify the user.
    onFailure: async ({ event, error }) => {
      const { pipelineId } = event.data.event.data;
      await inngest.send(events.pipelineRunFailed.create({ pipelineId, error: error.message }));
    },
  },
  async ({ event, step, logger }) => {
    const { pipelineId, userId, idea, stageModels } = event.data;
    logger.info("pipeline.start", { pipelineId });

    const artifacts = {} as Record<ProcessingStage, unknown>;

    for (const stage of PROCESSING_STAGES) {
      const model = stageModels[stage] ?? DEFAULT_MODEL_ID;
      const ctx: StageContext = { pipelineId, userId, idea, model, artifacts };

      // Durable boundary: this is where retries and replay happen.
      artifacts[stage] = await step.run(`stage:${stage}`, () => stageHandlers[stage](ctx));

      await step.sendEvent(
        `stage-completed:${stage}`,
        events.pipelineStageCompleted.create({ pipelineId, stage })
      );
    }

    await step.sendEvent(
      "run-completed",
      events.pipelineRunCompleted.create({ pipelineId, status: "completed" })
    );

    logger.info("pipeline.done", { pipelineId });
    return { pipelineId, status: "completed" as const, artifacts };
  }
);
