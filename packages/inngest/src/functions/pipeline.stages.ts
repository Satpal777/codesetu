import { z } from "zod";
import { generateStructured, generateProse } from "@repo/ai";
import type { ProcessingStage } from "../events.js";

/** What every stage handler receives. `artifacts` holds prior stages' output. */
export interface StageContext {
  pipelineId: string;
  userId: string;
  idea: string;
  /** "provider|model" id resolved for this stage. */
  model: string;
  artifacts: Record<string, unknown>;
}

export type StageHandler = (ctx: StageContext) => Promise<unknown>;

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

function withBoundary(stage: ProcessingStage, handler: StageHandler): StageHandler {
  return async (ctx) => {
    try {
      return await handler(ctx);
    } catch (err) {
      console.error(`[pipeline] stage="${stage}" model="${ctx.model}" pipeline="${ctx.pipelineId}"`, err);
      throw new StageError(stage, ctx.model, err);
    }
  };
}

const QuestionsSchema = z.object({
  questions: z.array(z.string()).min(2).max(8),
});

const ProductThinkingSchema = z.object({
  summary: z.string(),
  targetUsers: z.array(z.string()),
  coreValue: z.string(),
  risks: z.array(z.string()),
});

const PrdSchema = z.object({
  title: z.string(),
  overview: z.string(),
  features: z.array(z.object({ name: z.string(), description: z.string() })),
  nonGoals: z.array(z.string()),
  successMetrics: z.array(z.string()),
});

const TasksSchema = z.object({
  tasks: z.array(
    z.object({ title: z.string(), description: z.string(), priority: z.enum(["high", "medium", "low"]) })
  ),
});

const ReviewSchema = z.object({
  findings: z.array(z.string()),
  suggestions: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
});

const FixesSchema = z.object({
  appliedFixes: z.array(z.string()),
  summary: z.string(),
});

export const stageHandlers: Record<ProcessingStage, StageHandler> = {
  // Generate clarifying questions from the raw idea.
  request: withBoundary("request", async ({ idea, model }) => {
    const result = await generateStructured(model, {
      schema: QuestionsSchema,
      system:
        "You are a senior product consultant. Given a product idea, generate 3–6 targeted clarifying questions that will help you deeply understand scope, users, and constraints before writing any specs. Return JSON.",
      prompt: `Product idea: ${idea}`,
    });
    return { model, questions: result.questions };
  }),

  // Market and user analysis informed by clarification answers.
  product_thinking: withBoundary("product_thinking", async ({ idea, model, artifacts }) => {
    const clarifications = artifacts["clarifications"] ?? [];
    const result = await generateStructured(model, {
      schema: ProductThinkingSchema,
      system:
        "You are a product strategist. Analyse the idea and clarifications to produce a clear product thinking document.",
      prompt: `Idea: ${idea}\n\nClarifications: ${JSON.stringify(clarifications)}`,
    });
    return { model, ...result };
  }),

  // Full PRD from product thinking.
  prd: withBoundary("prd", async ({ idea, model, artifacts }) => {
    const result = await generateStructured(model, {
      schema: PrdSchema,
      system: "You are a product manager. Write a concise PRD from the product thinking document.",
      prompt: `Idea: ${idea}\n\nProduct thinking: ${JSON.stringify(artifacts["product_thinking"])}`,
    });
    return { model, ...result };
  }),

  // Task list from PRD.
  tasks: withBoundary("tasks", async ({ model, artifacts }) => {
    const result = await generateStructured(model, {
      schema: TasksSchema,
      system: "Break this PRD into a short, ordered list of concrete build tasks. Max 10 tasks.",
      prompt: `PRD: ${JSON.stringify(artifacts["prd"])}`,
    });
    return { model, tasks: result.tasks };
  }),

  // Implementation outline (shallow — real code push is a future milestone).
  implementation: withBoundary("implementation", async ({ model, artifacts }) => {
    const outline = await generateProse(model, {
      system:
        "You are a senior engineer. Give a focused implementation plan: architecture choices, file structure, key algorithms. Be concrete and actionable. No full code.",
      prompt: `Tasks: ${JSON.stringify(artifacts["tasks"])}\n\nPRD: ${JSON.stringify(artifacts["prd"])}`,
    });
    return { model, outline };
  }),

  // Code review of the implementation plan.
  review: withBoundary("review", async ({ model, artifacts }) => {
    const result = await generateStructured(model, {
      schema: ReviewSchema,
      system: "Review the implementation plan. Identify gaps, risks, and improvement suggestions.",
      prompt: `Implementation plan: ${JSON.stringify(artifacts["implementation"])}`,
    });
    return { model, ...result };
  }),

  // Apply suggested fixes from the review.
  fixes: withBoundary("fixes", async ({ model, artifacts }) => {
    const result = await generateStructured(model, {
      schema: FixesSchema,
      system: "Apply the review suggestions to produce an improved implementation plan summary.",
      prompt: `Implementation: ${JSON.stringify(artifacts["implementation"])}\n\nReview: ${JSON.stringify(artifacts["review"])}`,
    });
    return { model, ...result };
  }),

  // Approval is a human-in-the-loop gate handled in the orchestrator; no AI call.
  approval: async ({ model }) => ({
    model,
    note: "Awaiting user approval before release.",
  }),

  // Release summary.
  release: withBoundary("release", async ({ model, artifacts }) => {
    const summary = await generateProse(model, {
      system: "Write a concise release summary for the product based on what was built.",
      prompt: `PRD: ${JSON.stringify(artifacts["prd"])}\n\nFixes: ${JSON.stringify(artifacts["fixes"])}`,
    });
    return { model, summary, deploymentUrl: null };
  }),
};
