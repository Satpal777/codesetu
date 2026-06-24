import { eventType } from "inngest";
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Event catalog — the single source of truth for everything that can
 * flow through Inngest.
 *
 * Each event is an `eventType(name, { schema })`. The Zod schema (Standard
 * Schema) gives full type-safety + runtime validation, and the returned
 * object doubles as the trigger you hand to a function. Send one with
 * `events.<name>.create(data)`.
 * ------------------------------------------------------------------ */

/** Every stage of the Codesetu pipeline, in order. Mirrors the landing UI. */
export const STAGE_IDS = ["idea", "document", "tasks", "code", "review", "deploy"] as const;
export type StageId = (typeof STAGE_IDS)[number];

/**
 * "idea" is the pipeline *input*; these are the stages that actually run and
 * produce an artifact. The orchestrator iterates over this list.
 */
export const PROCESSING_STAGES = ["document", "tasks", "code", "review", "deploy"] as const;
export type ProcessingStage = (typeof PROCESSING_STAGES)[number];

/* ----------------------------- Schemas ------------------------------ */

const pipelineRunRequestedSchema = z.object({
  pipelineId: z.string(),
  userId: z.string(),
  idea: z.string().min(1, "An idea is required to start a pipeline"),
});

const pipelineStageCompletedSchema = z.object({
  pipelineId: z.string(),
  stage: z.enum(PROCESSING_STAGES),
});

const pipelineRunCompletedSchema = z.object({
  pipelineId: z.string(),
  status: z.enum(["completed", "failed"]),
});

const pipelineRunFailedSchema = z.object({
  pipelineId: z.string(),
  error: z.string(),
});

const userCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
});

/* ----------------------------- Events ------------------------------- */

/**
 * The event registry. Adding an event is a one-line change here (plus its
 * schema above). Use as a trigger: `triggers: [{ event: events.foo }]`;
 * send it: `inngest.send(events.foo.create({ ... }))`.
 */
export const events = {
  pipelineRunRequested: eventType("pipeline/run.requested", { schema: pipelineRunRequestedSchema }),
  pipelineStageCompleted: eventType("pipeline/stage.completed", { schema: pipelineStageCompletedSchema }),
  pipelineRunCompleted: eventType("pipeline/run.completed", { schema: pipelineRunCompletedSchema }),
  pipelineRunFailed: eventType("pipeline/run.failed", { schema: pipelineRunFailedSchema }),
  userCreated: eventType("user/created", { schema: userCreatedSchema }),
} as const;

/* ----------------------- Inferred payload types --------------------- */

export type PipelineRunRequestedData = z.infer<typeof pipelineRunRequestedSchema>;
export type PipelineStageCompletedData = z.infer<typeof pipelineStageCompletedSchema>;
export type PipelineRunCompletedData = z.infer<typeof pipelineRunCompletedSchema>;
export type PipelineRunFailedData = z.infer<typeof pipelineRunFailedSchema>;
export type UserCreatedData = z.infer<typeof userCreatedSchema>;
