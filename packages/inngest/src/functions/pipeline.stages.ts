import { z } from "zod";
import { generateStructured, generateProse } from "@repo/ai";
import type { ProcessingStage } from "../events.js";

/* ------------------------------------------------------------------ *
 * Per-stage handlers for the Codesetu pipeline.
 *
 * Each handler is the real unit of work for one stage, kept separate from
 * the orchestrator (pipeline.ts) so a stage can be edited and reasoned
 * about in isolation. Every handler receives `model` — the "provider|model"
 * chosen for THIS stage in the UI — and runs against it via @repo/ai, so
 * switching provider is just a different string. Each returns `model` in
 * its output so the chosen provider is visible in the Inngest run.
 * ------------------------------------------------------------------ */

/** What every stage handler receives. `artifacts` holds prior stages' output. */
export interface StageContext {
  pipelineId: string;
  userId: string;
  idea: string;
  /** "provider|model" id resolved for this stage. */
  model: string;
  artifacts: Record<ProcessingStage, unknown>;
}

export type StageHandler = (ctx: StageContext) => Promise<unknown>;

/* ------------------------------------------------------------------ *
 * Error boundary — wraps every AI-calling handler so failures surface
 * the stage name, model id, and root cause in Inngest's retry logs.
 * ------------------------------------------------------------------ */

export class StageError extends Error {
  constructor(
    public readonly stage: ProcessingStage,
    public readonly modelId: string,
    cause: unknown,
  ) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Stage "${stage}" failed (model: ${modelId}): ${msg}`);
    this.name = "StageError";
    this.cause = cause;
  }
}

function withErrorBoundary(stage: ProcessingStage, handler: StageHandler): StageHandler {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (err) {
      // Log enough context to debug multi-provider issues from a run log.
      console.error(`[pipeline] stage="${stage}" model="${ctx.model}" pipeline="${ctx.pipelineId}"`, err);
      throw new StageError(stage, ctx.model, err);
    }
  };
}

const PrdSchema = z.object({
  title: z.string(),
  summary: z.string(),
  requirements: z.array(z.string()),
});

export const stageHandlers: Record<ProcessingStage, StageHandler> = {
  // Idea → PRD.
  document: withErrorBoundary("document", async ({ idea, model }) => {
    const prd = await generateStructured(model, {
      schema: PrdSchema,
      system: "You are a product manager. Turn the idea into a concise PRD.",
      prompt: `Idea: ${idea}`,
    });
    return { model, prd };
  }),

  // PRD → ordered task list.
  tasks: withErrorBoundary("tasks", async ({ model, artifacts }) => {
    const { tasks } = await generateStructured(model, {
      schema: z.object({ tasks: z.array(z.string()) }),
      system: "Break the PRD into a short, ordered list of concrete build tasks.",
      prompt: `PRD: ${JSON.stringify(artifacts.document)}`,
    });
    return { model, tasks };
  }),

  // Tasks → implementation outline. (Real codegen is a later milestone.)
  code: withErrorBoundary("code", async ({ model, artifacts }) => {
    const outline = await generateProse(model, {
      system: "You are a senior engineer. Give a brief implementation outline — no full code.",
      prompt: `Tasks: ${JSON.stringify(artifacts.tasks)}`,
    });
    return { model, outline };
  }),

  // Code → review notes.
  review: withErrorBoundary("review", async ({ model, artifacts }) => {
    const notes = await generateProse(model, {
      system: "Review the plan in 3–5 bullet points and call out the main risks.",
      prompt: `Implementation outline: ${JSON.stringify(artifacts.code)}`,
    });
    return { model, notes };
  }),

  // Review → deploy. Not an AI step — it ships. Placeholder for now.
  deploy: async ({ model }) => ({ model, url: "https://preview.codesetu.app/placeholder" }),
};

