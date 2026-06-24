import { z } from "zod";

export const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  emailVerified: z.boolean(),
  image: z.string().url().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

export const UpdateProfileInputSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  image: z.string().url("Invalid image URL").nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const StartPipelineInputSchema = z.object({
  idea: z.string().min(1, "An idea is required").max(2000, "Idea is too long"),
});

export type StartPipelineInput = z.infer<typeof StartPipelineInputSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    status: z.enum(["success", "error"]),
    message: z.string().optional(),
    data: dataSchema.optional(),
  });
