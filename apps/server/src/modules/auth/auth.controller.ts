import { Response, NextFunction } from "express";
import { UserResponseSchema, UpdateProfileInputSchema } from "@repo/schemas";
import { db, user, eq } from "@repo/database";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";

export const AuthController = {
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Not authenticated", 401);
      }

      const safeUser = UserResponseSchema.parse(req.user);

      res.status(200).json({
        status: "success",
        data: { user: safeUser },
      });
    } catch (err) {
      next(err);
    }
  },

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError("Not authenticated", 401);
      }

      // 1. Input Validation using Zod
      const validatedInput = UpdateProfileInputSchema.parse(req.body);

      // 2. Perform DB Updates
      const updatedUsers = await db
        .update(user)
        .set({
          ...validatedInput,
          updatedAt: new Date(),
        })
        .where(eq(user.id, req.user.id))
        .returning();

      const updatedUser = updatedUsers[0];
      if (!updatedUser) {
        throw new AppError("Failed to update user profile", 500);
      }

      // 3. Output Validation using Zod
      const safeUser = UserResponseSchema.parse(updatedUser);

      res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        data: { user: safeUser },
      });
    } catch (err) {
      next(err);
    }
  },
};
