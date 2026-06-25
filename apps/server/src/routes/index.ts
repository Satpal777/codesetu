import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { pipelineRouter } from "../modules/pipeline/pipeline.routes.js";
import { modelsRouter } from "../modules/models/models.routes.js";
import { projectsRouter } from "../modules/projects/projects.routes.js";

const router = Router();

router.use("/user", authRouter);
router.use("/pipeline", pipelineRouter);
router.use("/models", modelsRouter);
router.use("/projects", projectsRouter);

router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.get("/message", (req, res) => {
  res.json({
    message: "Hello from Codesetu Express backend!",
    features: [
      "Turborepo monorepo setup",
      "Next.js (App Router) frontend",
      "Express.js & TypeScript backend",
      "Shared UI components package",
      "Better Auth with Google OAuth (Continue with Google)",
      "Shared API input/output validation schemas using Zod",
    ],
    timestamp: new Date().toISOString(),
  });
});

export const apiRouter = router;
