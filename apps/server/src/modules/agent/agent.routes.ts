import { Router } from "express";
import { AgentController } from "./agent.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

// mergeParams so ":id" from the parent mount is visible here.
const router = Router({ mergeParams: true });

router.post("/:id/agent/chat", authGuard, AgentController.chat);
router.get("/:id/agent/messages", authGuard, AgentController.messages);
router.get("/:id/preview/*", authGuard, AgentController.preview);

export const agentRouter = router;
