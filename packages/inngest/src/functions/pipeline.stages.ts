import type { ProcessingStage } from "../events.js";

/* ------------------------------------------------------------------ *
 * Per-stage handlers for the Codesetu pipeline.
 *
 * Each handler is the real unit of work for one stage. They are kept
 * separate from the orchestrator (pipeline.ts) so a stage can be edited,
 * tested, and reasoned about in isolation — the orchestrator only decides
 * *ordering* and *durability*, never *what a stage does*.
 *
 * Every handler below is a PLACEHOLDER. Replace its body with the real
 * implementation (LLM calls, DB writes, sandbox execution, …). The two
 * generative stages should call Claude (claude-opus-4-8 for code, a
 * cheaper model for planning) once an AI client is wired up.
 * ------------------------------------------------------------------ */

/** What every stage handler receives. `artifacts` holds prior stages' output. */
export interface StageContext {
  pipelineId: string;
  userId: string;
  idea: string;
  artifacts: Record<ProcessingStage, unknown>;
}

export type StageHandler = (ctx: StageContext) => Promise<unknown>;

export const stageHandlers: Record<ProcessingStage, StageHandler> = {
  // Idea → PRD. TODO: prompt an LLM to turn `idea` into a structured PRD.
  document: async ({ idea }) => ({
    prd: `# Product Requirements\n\nDrafted from idea: ${idea}`,
  }),

  // PRD → task list. TODO: decompose the PRD into ordered, scoped todos.
  tasks: async ({ artifacts }) => ({
    tasks: ["Scaffold project", "Implement core feature", "Write tests"],
    from: artifacts.document,
  }),

  // Tasks → code. TODO: generate code (e.g. in a sandbox) for each task.
  code: async () => ({ files: [], sandboxId: null }),

  // Code → review. TODO: run automated review / checks and gate on the result.
  review: async () => ({ approved: true, comments: [] }),

  // Review → deploy. TODO: ship the approved build and return the live URL.
  deploy: async () => ({ url: "https://preview.codesetu.app/placeholder" }),
};
