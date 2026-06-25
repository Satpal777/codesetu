const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

/** The nine pipeline stages, in order. */
export type StageType =
  | "request"
  | "product_thinking"
  | "prd"
  | "tasks"
  | "implementation"
  | "review"
  | "fixes"
  | "approval"
  | "release";

export type StageStatus = "pending" | "running" | "awaiting_input" | "completed" | "failed";
export type ProjectStatus = "running" | "awaiting_input" | "completed" | "failed";

export interface Stage {
  id: string;
  projectId: string;
  type: StageType;
  status: StageStatus;
  order: number;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface Artifact {
  id: string;
  projectId: string;
  stageId: string;
  type: StageType;
  content: unknown;
  version: number;
  createdAt: string;
}

export interface Clarification {
  id: string;
  projectId: string;
  question: string;
  answer?: string | null;
  order: number;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  prompt: string;
  status: ProjectStatus;
  currentStage: StageType;
  repoUrl?: string | null;
  repoBranch?: string | null;
  createdAt: string;
  updatedAt: string;
  stages?: Stage[];
  artifacts?: Artifact[];
  clarifications?: Clarification[];
}

export const STAGES: { type: StageType; label: string; description: string }[] = [
  { type: "request", label: "Request", description: "Clarifying questions" },
  { type: "product_thinking", label: "Product Thinking", description: "Market & user analysis" },
  { type: "prd", label: "PRD", description: "Product requirements" },
  { type: "tasks", label: "Tasks", description: "Work breakdown" },
  { type: "implementation", label: "Implementation", description: "Code plan" },
  { type: "review", label: "Review", description: "Code review" },
  { type: "fixes", label: "Fixes", description: "Applied improvements" },
  { type: "approval", label: "Approval", description: "Final sign-off" },
  { type: "release", label: "Release", description: "Ship it" },
];

export const STAGE_COUNT = STAGES.length;

export function stageIndex(type: StageType): number {
  const i = STAGES.findIndex((s) => s.type === type);
  return i === -1 ? 0 : i;
}

export function stageLabel(type: StageType): string {
  return STAGES[stageIndex(type)]?.label ?? type;
}

/* ----------------------------- Models ------------------------------ */

export type ModelProvider = "openai" | "anthropic" | "free";
export type ModelTier = "premium" | "fast" | "free";

export interface ModelInfo {
  id: string;
  label: string;
  provider: ModelProvider;
  tier: ModelTier;
}

export interface ModelsConfig {
  models: ModelInfo[];
  defaultModelId: string;
  stages: string[];
}

export async function fetchModels(signal?: AbortSignal): Promise<ModelsConfig> {
  const res = await fetch(`${BACKEND_URL}/api/models`, { credentials: "include", signal });
  if (!res.ok) throw new Error(`Couldn't load models (${res.status}).`);
  const json = await res.json() as { data: ModelsConfig };
  return json.data;
}

/* ----------------------------- Projects API ------------------------ */

export interface StartPipelineInput {
  prompt: string;
  defaultModelId?: string;
  overrides?: Record<string, string>;
}

/** GET /api/projects */
export async function listProjects(signal?: AbortSignal): Promise<Project[]> {
  const res = await fetch(`${BACKEND_URL}/api/projects`, { credentials: "include", signal });
  if (!res.ok) throw new Error(`Couldn't load your projects (${res.status}).`);
  const json = await res.json() as { data: { projects: Project[] } };
  return json.data?.projects ?? [];
}

/** POST /api/projects */
export async function createProject(input: StartPipelineInput): Promise<Project> {
  const res = await fetch(`${BACKEND_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      prompt: input.prompt,
      defaultModelId: input.defaultModelId || undefined,
      overrides: input.overrides && Object.keys(input.overrides).length ? input.overrides : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Couldn't start the pipeline (${res.status}).`);
  }
  const json = await res.json() as { data: { project: Project } };
  return json.data.project;
}

/** GET /api/projects/:id */
export async function getProject(id: string, signal?: AbortSignal): Promise<Project> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${id}`, { credentials: "include", signal });
  if (!res.ok) throw new Error(`Couldn't load project (${res.status}).`);
  const json = await res.json() as { data: { project: Project } };
  return json.data.project;
}

/** GET /api/projects/:id/clarifications */
export async function getClarifications(id: string, signal?: AbortSignal): Promise<Clarification[]> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${id}/clarifications`, { credentials: "include", signal });
  if (!res.ok) throw new Error(`Couldn't load clarifications (${res.status}).`);
  const json = await res.json() as { data: { clarifications: Clarification[] } };
  return json.data?.clarifications ?? [];
}

/** POST /api/projects/:id/clarifications */
export async function submitClarifications(
  id: string,
  answers: Array<{ id: string; answer: string }>
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${id}/clarifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ answers }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Couldn't submit answers (${res.status}).`);
  }
}

/** POST /api/projects/:id/approve */
export async function approveProject(id: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Couldn't approve project (${res.status}).`);
  }
}

/** Compact relative time, e.g. "just now", "5m ago", "3d ago". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
