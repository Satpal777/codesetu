import { Router } from "express";
import { PipelineController } from "./pipeline.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/run", authGuard, PipelineController.start);

export const pipelineRouter = router;
