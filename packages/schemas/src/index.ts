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

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    status: z.enum(["success", "error"]),
    message: z.string().optional(),
    data: dataSchema.optional(),
  });

// ---------------------------------------------------------------------------
// ShipFlow pipeline schemas
// ---------------------------------------------------------------------------

export const STAGE_TYPES = [
  "request",
  "product_thinking",
  "prd",
  "tasks",
  "implementation",
  "review",
  "fixes",
  "approval",
  "release",
] as const;

export const StageTypeSchema = z.enum(STAGE_TYPES);
export type StageTypeValue = z.infer<typeof StageTypeSchema>;

export const StageStatusSchema = z.enum([
  "pending",
  "running",
  "awaiting_input",
  "completed",
  "failed",
]);
export type StageStatusValue = z.infer<typeof StageStatusSchema>;

export const ProjectStatusSchema = z.enum([
  "running",
  "awaiting_input",
  "completed",
  "failed",
]);
export type ProjectStatusValue = z.infer<typeof ProjectStatusSchema>;

// --- Inputs ---

export const CreateProjectInputSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  title: z.string().min(1).optional(),
  repoUrl: z.string().url("Invalid repository URL").optional(),
  repoBranch: z.string().min(1).optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const ClarificationAnswerInputSchema = z.object({
  answers: z
    .array(
      z.object({
        id: z.string(),
        answer: z.string().min(1, "Answer cannot be empty"),
      })
    )
    .min(1, "At least one answer is required"),
});
export type ClarificationAnswerInput = z.infer<
  typeof ClarificationAnswerInputSchema
>;

// --- Responses ---

export const ProjectResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  prompt: z.string(),
  status: ProjectStatusSchema,
  currentStage: StageTypeSchema,
  repoUrl: z.string().nullable().optional(),
  repoBranch: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export const StageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  type: StageTypeSchema,
  status: StageStatusSchema,
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
  type: StageTypeSchema,
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

export const ProjectDetailSchema = z.object({
  project: ProjectResponseSchema,
  stages: z.array(StageSchema),
  artifacts: z.array(ArtifactSchema),
  clarifications: z.array(ClarificationSchema),
});
export type ProjectDetail = z.infer<typeof ProjectDetailSchema>;
