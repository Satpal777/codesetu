import { Router } from "express";
import { ModelsController } from "./models.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

const router = Router();

// Authenticated catalog — no secrets, but avoids unauthenticated provider enumeration.
router.get("/", authGuard, ModelsController.list);

export const modelsRouter = router;
