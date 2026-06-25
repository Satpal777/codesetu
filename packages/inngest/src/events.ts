import { eventType } from "inngest";
import { z } from "zod";

/** Every stage of the ShipFlow pipeline, in order. */
export const STAGE_IDS = [
  "request",
  "product_thinking",
  "prd",
  "tasks",
  "implementation",
  "review",
  "fixes",
  "approval",
  "release",
] as const;
export type StageId = (typeof STAGE_IDS)[number];

/**
 * All pipeline stages that the orchestrator runs through.
 * "request" generates clarifying questions (awaiting_input pause),
 * "approval" is a human-in-the-loop gate before release.
 */
export const PROCESSING_STAGES = STAGE_IDS;
export type ProcessingStage = StageId;

/* ----------------------------- Schemas ------------------------------ */

const pipelineRunRequestedSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  idea: z.string().min(1),
  stageModels: z.record(z.string(), z.string()),
});

const pipelineStageCompletedSchema = z.object({
  projectId: z.string(),
  stage: z.enum(PROCESSING_STAGES),
});

const pipelineRunCompletedSchema = z.object({
  projectId: z.string(),
  status: z.enum(["completed", "failed"]),
});

const pipelineRunFailedSchema = z.object({
  projectId: z.string(),
  error: z.string(),
});

const clarificationsSubmittedSchema = z.object({
  projectId: z.string(),
});

const approvalGrantedSchema = z.object({
  projectId: z.string(),
});

const userCreatedSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
});

/* ----------------------------- Events ------------------------------- */

export const events = {
  pipelineRunRequested: eventType("pipeline/run.requested", { schema: pipelineRunRequestedSchema }),
  pipelineStageCompleted: eventType("pipeline/stage.completed", { schema: pipelineStageCompletedSchema }),
  pipelineRunCompleted: eventType("pipeline/run.completed", { schema: pipelineRunCompletedSchema }),
  pipelineRunFailed: eventType("pipeline/run.failed", { schema: pipelineRunFailedSchema }),
  clarificationsSubmitted: eventType("pipeline/clarifications.submitted", { schema: clarificationsSubmittedSchema }),
  approvalGranted: eventType("pipeline/approval.granted", { schema: approvalGrantedSchema }),
  userCreated: eventType("user/created", { schema: userCreatedSchema }),
} as const;

export type PipelineRunRequestedData = z.infer<typeof pipelineRunRequestedSchema>;
export type PipelineStageCompletedData = z.infer<typeof pipelineStageCompletedSchema>;
export type PipelineRunCompletedData = z.infer<typeof pipelineRunCompletedSchema>;
export type PipelineRunFailedData = z.infer<typeof pipelineRunFailedSchema>;
export type UserCreatedData = z.infer<typeof userCreatedSchema>;
