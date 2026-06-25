import { randomUUID } from "node:crypto";
import { DEFAULT_MODEL_ID } from "@repo/ai";
import { db, project as projectTable, stage as stageTable, artifact as artifactTable, clarification as clarificationTable, eq, and } from "@repo/database";
import { inngest } from "../client.js";
import { events, PROCESSING_STAGES, type ProcessingStage } from "../events.js";
import { pipelineEmitter } from "../sse.js";
import { stageHandlers, type StageContext } from "./pipeline.stages.js";

function emit(projectId: string, stageName: string, status: string, artifact?: unknown) {
  pipelineEmitter.emit("update", { projectId, stage: stageName, status, artifact });
}

export const runPipeline = inngest.createFunction(
  {
    id: "run-pipeline",
    name: "Run ShipFlow pipeline",
    retries: 3,
    triggers: [{ event: events.pipelineRunRequested }],
    onFailure: async ({ event, error }) => {
      const { projectId } = event.data.event.data;
      await db.update(projectTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(projectTable.id, projectId));
      emit(projectId, "", "failed");
      await inngest.send(events.pipelineRunFailed.create({ projectId, error: error.message }));
    },
  },
  async ({ event, step, logger }) => {
    const { projectId, userId, idea, stageModels } = event.data;
    logger.info("pipeline.start", { projectId });

    // Fetch stages from DB (created by the API when the project was created).
    const dbStages = await step.run("fetch-stages", async () => {
      return db.select().from(stageTable)
        .where(eq(stageTable.projectId, projectId))
        .orderBy(stageTable.order);
    });

    const artifacts: Record<string, unknown> = {};

    for (const stageName of PROCESSING_STAGES) {
      const dbStage = dbStages.find((s) => s.type === stageName);
      if (!dbStage) {
        logger.warn(`Stage "${stageName}" not found in DB for project ${projectId}`);
        continue;
      }

      const model = stageModels[stageName] ?? DEFAULT_MODEL_ID;

      // ── Mark stage running ───────────────────────────────────────────────
      await step.run(`mark-running:${stageName}`, async () => {
        await db.update(stageTable)
          .set({ status: "running", startedAt: new Date() })
          .where(eq(stageTable.id, dbStage.id));
        await db.update(projectTable)
          .set({ currentStage: stageName as ProcessingStage, status: "running", updatedAt: new Date() })
          .where(eq(projectTable.id, projectId));
        emit(projectId, stageName, "running");
      });

      // ── Request stage: generate clarifying questions ─────────────────────
      if (stageName === "request") {
        const ctx: StageContext = { pipelineId: projectId, userId, idea, model, artifacts };
        const result = await step.run("run:request", () => stageHandlers.request(ctx)) as { questions: string[] };

        await step.run("save-clarifications", async () => {
          const rows = (result.questions ?? []).map((q, i) => ({
            id: randomUUID(),
            projectId,
            question: q,
            order: i,
            createdAt: new Date(),
          }));
          if (rows.length > 0) await db.insert(clarificationTable).values(rows);

          await db.insert(artifactTable).values({
            id: randomUUID(),
            projectId,
            stageId: dbStage.id,
            type: "request",
            content: result as Record<string, unknown>,
            version: 1,
            createdAt: new Date(),
          });

          await db.update(stageTable)
            .set({ status: "awaiting_input" })
            .where(eq(stageTable.id, dbStage.id));
          await db.update(projectTable)
            .set({ status: "awaiting_input", updatedAt: new Date() })
            .where(eq(projectTable.id, projectId));

          emit(projectId, "request", "awaiting_input", result);
        });

        artifacts["request"] = result;

        // Pause until the user answers the clarifying questions.
        await step.waitForEvent("wait-clarifications", {
          event: "pipeline/clarifications.submitted",
          match: "data.projectId",
          timeout: "7d",
        });

        // Fetch answers from DB after resume.
        const answers = await step.run("fetch-clarifications", async () => {
          return db.select().from(clarificationTable)
            .where(and(eq(clarificationTable.projectId, projectId)))
            .orderBy(clarificationTable.order);
        });
        artifacts["clarifications"] = answers.map((r) => ({
          question: r.question,
          answer: r.answer ?? "",
        }));

        await step.run("complete:request", async () => {
          await db.update(stageTable)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(stageTable.id, dbStage.id));
          await db.update(projectTable)
            .set({ status: "running", updatedAt: new Date() })
            .where(eq(projectTable.id, projectId));
          emit(projectId, "request", "completed");
        });

        continue;
      }

      // ── Approval stage: wait for user approval ───────────────────────────
      if (stageName === "approval") {
        await step.run("set-approval-waiting", async () => {
          await db.update(stageTable)
            .set({ status: "awaiting_input", startedAt: new Date() })
            .where(eq(stageTable.id, dbStage.id));
          await db.update(projectTable)
            .set({ status: "awaiting_input", updatedAt: new Date() })
            .where(eq(projectTable.id, projectId));
          emit(projectId, "approval", "awaiting_input");
        });

        await step.waitForEvent("wait-approval", {
          event: "pipeline/approval.granted",
          match: "data.projectId",
          timeout: "30d",
        });

        await step.run("complete:approval", async () => {
          const approvalArtifact = { approvedAt: new Date().toISOString() };
          await db.insert(artifactTable).values({
            id: randomUUID(),
            projectId,
            stageId: dbStage.id,
            type: "approval",
            content: approvalArtifact,
            version: 1,
            createdAt: new Date(),
          });
          await db.update(stageTable)
            .set({ status: "completed", completedAt: new Date() })
            .where(eq(stageTable.id, dbStage.id));
          await db.update(projectTable)
            .set({ status: "running", updatedAt: new Date() })
            .where(eq(projectTable.id, projectId));
          emit(projectId, "approval", "completed");
        });

        artifacts["approval"] = { approvedAt: new Date().toISOString() };
        continue;
      }

      // ── Normal AI stage ─────────────────────────────────────────────────
      const ctx: StageContext = { pipelineId: projectId, userId, idea, model, artifacts };
      const result = await step.run(`run:${stageName}`, () =>
        stageHandlers[stageName as ProcessingStage](ctx)
      );

      artifacts[stageName] = result;

      await step.run(`finish:${stageName}`, async () => {
        await db.insert(artifactTable).values({
          id: randomUUID(),
          projectId,
          stageId: dbStage.id,
          type: stageName as ProcessingStage,
          content: result as Record<string, unknown>,
          version: 1,
          createdAt: new Date(),
        });
        await db.update(stageTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(stageTable.id, dbStage.id));

        await step.sendEvent(`stage-completed:${stageName}`,
          events.pipelineStageCompleted.create({ projectId, stage: stageName as ProcessingStage })
        );

        emit(projectId, stageName, "completed", result);
      });
    }

    // ── Mark project completed ───────────────────────────────────────────
    await step.run("complete-project", async () => {
      await db.update(projectTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(projectTable.id, projectId));
      emit(projectId, "release", "completed");
    });

    await step.sendEvent("run-completed",
      events.pipelineRunCompleted.create({ projectId, status: "completed" })
    );

    logger.info("pipeline.done", { projectId });
    return { projectId, status: "completed" as const };
  }
);
