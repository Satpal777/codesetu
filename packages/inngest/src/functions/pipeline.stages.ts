import { z } from "zod";
import { generateStructured, generateProse } from "@repo/ai";
import type { ProcessingStage } from "../events.js";
import { renderMockupSvg, type MockupSpec } from "./mockup.js";

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
  questions: z
    .array(
      z.object({
        // A single, plain-language question a non-technical person can answer.
        question: z.string(),
        // 3–5 concrete answer choices in everyday language (no jargon).
        options: z.array(z.string()).min(3).max(5),
        // Allow multiple choices when the question is naturally "select all that apply".
        multiSelect: z.boolean(),
      }),
    )
    .min(2)
    .max(5),
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

const LayoutSpecSchema = z.object({
  // A short, human label for the screen being designed.
  screen: z.string(),
  // An ordered list of sections, top to bottom. `items` carries link/feature/row
  // labels; `cta` is a button label. Keep all copy short and real.
  sections: z
    .array(
      z.object({
        type: z.enum([
          "navbar",
          "hero",
          "form",
          "features",
          "gallery",
          "list",
          "cta",
          "content",
          "footer",
        ]),
        title: z.string().nullable(),
        subtitle: z.string().nullable(),
        items: z.array(z.string()).nullable(),
        cta: z.string().nullable(),
      }),
    )
    .min(2)
    .max(7),
});

const TasksSchema = z.object({
  tasks: z.array(
    z.object({ title: z.string(), description: z.string(), priority: z.enum(["high", "medium", "low"]) })
  ),
});

const CodeSchema = z.object({
  // The file the preview/deploy should open first.
  entry: z.string(),
  // A small, self-contained static web app. No build step, no npm install.
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      }),
    )
    .min(1)
    .max(8),
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
  // Generate clarifying questions from the raw idea. The person answering is NOT
  // technical, so every question is multiple-choice in plain language.
  request: withBoundary("request", async ({ idea, model }) => {
    const result = await generateStructured(model, {
      schema: QuestionsSchema,
      system:
        "You are a friendly product guide helping a non-technical person turn an idea into an app. " +
        "Generate 2–4 clarifying questions about scope, audience, and what matters most. " +
        "Rules: write for someone with zero technical background — no jargon (never say 'CRUD', 'auth', 'schema', 'API', 'stack'). " +
        "Each question must offer 3–5 concrete, everyday-language answer choices the person can simply tap. " +
        "Make choices specific to THIS idea, not generic. Set multiSelect to true only when picking several answers is natural. " +
        "A 'write your own' escape hatch is added automatically, so do not include one. Return JSON.",
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

  // Design the main screen as a structured layout, then render a preview mockup.
  design: withBoundary("design", async ({ idea, model, artifacts }) => {
    const spec = await generateStructured(model, {
      schema: LayoutSpecSchema,
      system:
        "You are a senior product designer. Design the single most important screen of this app as a structured layout: " +
        "an ordered list of sections from top to bottom. Pick from navbar, hero, form, features, gallery, list, cta, content, footer. " +
        "Write short, real copy (titles, subtitles, button labels, item names) — never lorem ipsum, never jargon. " +
        "Keep it to one screen with 3–6 sections. Return JSON.",
      prompt: `Idea: ${idea}\n\nWhat we're building: ${JSON.stringify(artifacts["prd"] ?? artifacts["product_thinking"])}`,
    });
    // Deterministic, on-brand preview image rendered from the spec (no image model).
    const imageSvg = renderMockupSvg(spec as MockupSpec);
    return { model, spec, imageSvg };
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

  // Build the real, runnable app: a self-contained static site that matches the
  // approved design. No build step so it previews instantly and deploys as static.
  implementation: withBoundary("implementation", async ({ idea, model, artifacts }) => {
    const design = (artifacts["design"] as { spec?: unknown } | undefined)?.spec;
    const result = await generateStructured(model, {
      schema: CodeSchema,
      system:
        "You are a senior full-stack engineer. Build a complete, functional web application. " +
        "If it is a plain static website (HTML, CSS, JS), the entry file MUST be 'index.html'. " +
        "If it requires a backend or full-stack server (Node.js, Bun, Python, Go, etc.), you MUST always generate a 'Dockerfile' at the root of the project that builds and runs the application, exposing it on port 8080. " +
        "No binary assets — use CSS, emoji, or inline SVG. Match the provided design's sections, layout, and copy closely. " +
        "Make it polished, responsive, and genuinely functional (forms, interactions) where it makes sense. Return JSON with the files.",
      prompt: `Idea: ${idea}\n\nWhat we're building: ${JSON.stringify(artifacts["prd"])}\n\nDesign to match: ${JSON.stringify(design)}`,
    });
    return { model, entry: result.entry, files: result.files };
  }),

  // Code review of the generated app.
  review: withBoundary("review", async ({ model, artifacts }) => {
    const result = await generateStructured(model, {
      schema: ReviewSchema,
      system: "Review the generated code for bugs, accessibility issues, and rough edges. Identify concrete findings and suggestions.",
      prompt: `Generated files: ${JSON.stringify(artifacts["implementation"])}`,
    });
    return { model, ...result };
  }),

  // Summarise the fixes implied by the review (advisory for this milestone).
  fixes: withBoundary("fixes", async ({ model, artifacts }) => {
    const result = await generateStructured(model, {
      schema: FixesSchema,
      system: "Given the code and its review, summarise the improvements that should be applied.",
      prompt: `Review: ${JSON.stringify(artifacts["review"])}`,
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
