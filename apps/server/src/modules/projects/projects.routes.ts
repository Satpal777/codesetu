import { Router } from "express";
import { ProjectsController } from "./projects.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/", authGuard, ProjectsController.create);
router.get("/", authGuard, ProjectsController.list);
router.get("/:id", authGuard, ProjectsController.get);
router.get("/:id/stream", authGuard, ProjectsController.stream);
router.get("/:id/clarifications", authGuard, ProjectsController.getClarifications);
router.post("/:id/clarifications", authGuard, ProjectsController.submitClarifications);
router.post("/:id/approve", authGuard, ProjectsController.approve);
router.post("/:id/deploy", authGuard, ProjectsController.deploy);
router.delete("/", authGuard, ProjectsController.deleteAll);
router.delete("/:id", authGuard, ProjectsController.delete);

export const projectsRouter = router;
