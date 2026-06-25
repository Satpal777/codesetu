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

// ── Pipeline domain ────────────────────────────────────────────────────────

export const CreateProjectInputSchema = z.object({
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  title: z.string().optional(),
  repoUrl: z.string().url().optional(),
  repoBranch: z.string().optional(),
  defaultModelId: z.string().optional(),
  overrides: z.record(z.string(), z.string()).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const ClarificationAnswerSchema = z.object({
  answers: z.array(z.object({ id: z.string(), answer: z.string() })),
});
export type ClarificationAnswer = z.infer<typeof ClarificationAnswerSchema>;

export const StageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: z.string(),
  status: z.string(),
  order: z.number(),
  error: z.string().nullable().optional(),
  startedAt: z.date().or(z.string()).nullable().optional(),
  completedAt: z.date().or(z.string()).nullable().optional(),
});
export type Stage = z.infer<typeof StageSchema>;

export const ArtifactSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  stageId: z.string(),
  type: z.string(),
  content: z.unknown(),
  version: z.number(),
  createdAt: z.date().or(z.string()),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const ClarificationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  question: z.string(),
  answer: z.string().nullable().optional(),
  order: z.number(),
  createdAt: z.date().or(z.string()),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

export const ProjectResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  prompt: z.string(),
  status: z.string(),
  currentStage: z.string().nullable().optional(),
  repoUrl: z.string().nullable().optional(),
  repoBranch: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  stages: z.array(StageSchema).optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  clarifications: z.array(ClarificationSchema).optional(),
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
