import { randomUUID } from "node:crypto";
import { Response, NextFunction } from "express";
import {
  CreateProjectInputSchema,
  ClarificationAnswerSchema,
} from "@repo/schemas";
import {
  db,
  project as projectTable,
  stage as stageTable,
  artifact as artifactTable,
  clarification as clarificationTable,
  eq,
  and,
} from "@repo/database";
import { inngest, events, PROCESSING_STAGES, pipelineEmitter, type PipelineUpdate } from "@repo/inngest";
import { StageModelsInputSchema, resolveStageModels } from "@repo/ai";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";

const STAGE_ORDER = PROCESSING_STAGES as readonly string[];

export const ProjectsController = {
  /** POST /api/projects — create a project, seed stage rows, kick off the pipeline. */
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);

      const input = CreateProjectInputSchema.parse(req.body);
      const modelInput = StageModelsInputSchema.parse(req.body);
      const stageModels = resolveStageModels(modelInput, PROCESSING_STAGES);

      const projectId = randomUUID();
      const now = new Date();

      const title =
        input.title ||
        (input.prompt.length > 60 ? `${input.prompt.slice(0, 57)}…` : input.prompt);

      await db.insert(projectTable).values({
        id: projectId,
        userId: req.user.id,
        title,
        prompt: input.prompt,
        status: "running",
        currentStage: "request",
        repoUrl: input.repoUrl ?? null,
        repoBranch: input.repoBranch ?? null,
        createdAt: now,
        updatedAt: now,
      });

      const stageRows = STAGE_ORDER.map((type, i) => ({
        id: randomUUID(),
        projectId,
        type: type as typeof PROCESSING_STAGES[number],
        status: "pending" as const,
        order: i,
        error: null,
        startedAt: null,
        completedAt: null,
      }));
      await db.insert(stageTable).values(stageRows);

      await inngest.send(
        events.pipelineRunRequested.create({
          projectId,
          userId: req.user.id,
          idea: input.prompt,
          stageModels,
        })
      );

      res.status(201).json({
        status: "success",
        message: "Project created and pipeline started",
        data: {
          project: {
            id: projectId,
            title,
            prompt: input.prompt,
            status: "running",
            currentStage: "request",
            repoUrl: input.repoUrl ?? null,
            repoBranch: input.repoBranch ?? null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects — list all projects for the authenticated user. */
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);

      const projects = await db
        .select()
        .from(projectTable)
        .where(eq(projectTable.userId, req.user.id))
        .orderBy(projectTable.createdAt);

      res.status(200).json({
        status: "success",
        data: { projects },
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects/:id — project detail with stages, artifacts, clarifications. */
  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);

      const { id } = req.params as { id: string };
      const rows = await db
        .select()
        .from(projectTable)
        .where(and(eq(projectTable.id, id), eq(projectTable.userId, req.user.id)));
      const proj = rows[0];
      if (!proj) throw new AppError("Project not found", 404);

      const [stages, artifacts, clarifications] = await Promise.all([
        db.select().from(stageTable).where(eq(stageTable.projectId, id)).orderBy(stageTable.order),
        db.select().from(artifactTable).where(eq(artifactTable.projectId, id)),
        db.select().from(clarificationTable).where(eq(clarificationTable.projectId, id)).orderBy(clarificationTable.order),
      ]);

      res.status(200).json({
        status: "success",
        data: { project: { ...proj, stages, artifacts, clarifications } },
      });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects/:id/clarifications */
  async getClarifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };

      const projRows = await db.select().from(projectTable)
        .where(and(eq(projectTable.id, id), eq(projectTable.userId, req.user.id)));
      if (!projRows[0]) throw new AppError("Project not found", 404);

      const clarifications = await db.select().from(clarificationTable)
        .where(eq(clarificationTable.projectId, id))
        .orderBy(clarificationTable.order);

      res.status(200).json({ status: "success", data: { clarifications } });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/projects/:id/clarifications — save answers, resume pipeline. */
  async submitClarifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };

      const projRows = await db.select().from(projectTable)
        .where(and(eq(projectTable.id, id), eq(projectTable.userId, req.user.id)));
      if (!projRows[0]) throw new AppError("Project not found", 404);

      const { answers } = ClarificationAnswerSchema.parse(req.body);

      for (const { id: cId, answer } of answers) {
        await db.update(clarificationTable)
          .set({ answer })
          .where(and(eq(clarificationTable.id, cId), eq(clarificationTable.projectId, id)));
      }

      await inngest.send(events.clarificationsSubmitted.create({ projectId: id }));

      res.status(200).json({ status: "success", message: "Answers saved and pipeline resumed" });
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/projects/:id/approve */
  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };

      const projRows = await db.select().from(projectTable)
        .where(and(eq(projectTable.id, id), eq(projectTable.userId, req.user.id)));
      if (!projRows[0]) throw new AppError("Project not found", 404);

      await inngest.send(events.approvalGranted.create({ projectId: id }));

      res.status(200).json({ status: "success", message: "Project approved" });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects/:id/stream — SSE live updates. */
  stream(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        res.status(401).json({ status: "error", message: "Unauthorized" });
        return;
      }
      const { id } = req.params as { id: string };

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      // Send a keep-alive comment every 25 seconds.
      const keepAlive = setInterval(() => {
        res.write(": ping\n\n");
      }, 25000);

      const listener = (update: PipelineUpdate) => {
        if (update.projectId === id) {
          res.write(`data: ${JSON.stringify(update)}\n\n`);
        }
      };

      pipelineEmitter.on("update", listener);

      req.on("close", () => {
        clearInterval(keepAlive);
        pipelineEmitter.off("update", listener);
      });
    } catch (err) {
      next(err);
    }
  },
};
