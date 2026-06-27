import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/me", authGuard, AuthController.getMe);
router.put("/profile", authGuard, AuthController.updateProfile);

export const authRouter = router;
