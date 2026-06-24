/* ------------------------------------------------------------------ *
 * Dashboard data layer — types + thin fetch helpers for the projects
 * API described in Plan.md. Kept separate from the UI so components stay
 * presentational and the backend contract lives in one place.
 * ------------------------------------------------------------------ */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

/** The nine pipeline stages, in order (Plan.md `pgEnum stageType`). */
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

export type ProjectStatus = "running" | "awaiting_input" | "completed" | "failed";

export interface Project {
  id: string;
  title: string;
  prompt: string;
  status: ProjectStatus;
  currentStage: StageType;
  repoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const STAGES: { type: StageType; label: string }[] = [
  { type: "request", label: "Request" },
  { type: "product_thinking", label: "Product Thinking" },
  { type: "prd", label: "PRD" },
  { type: "tasks", label: "Tasks" },
  { type: "implementation", label: "Implementation" },
  { type: "review", label: "Review" },
  { type: "fixes", label: "Fixes" },
  { type: "approval", label: "Approval" },
  { type: "release", label: "Release" },
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
  /** The pipeline's stages, so per-stage selection stays in sync with what runs. */
  stages: string[];
}

/** GET /api/models — selectable models (only configured providers) + pipeline stages. */
export async function fetchModels(signal?: AbortSignal): Promise<ModelsConfig> {
  const res = await fetch(`${BACKEND_URL}/api/models`, { credentials: "include", signal });
  if (!res.ok) throw new Error(`Couldn't load models (${res.status}).`);
  const json = await res.json();
  return json.data as ModelsConfig;
}

export interface StartPipelineInput {
  prompt: string;
  defaultModelId?: string;
  overrides?: Record<string, string>;
}

/** GET /api/projects — the signed-in user's projects. */
export async function listProjects(signal?: AbortSignal): Promise<Project[]> {
  const res = await fetch(`${BACKEND_URL}/api/projects`, {
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(`Couldn't load your projects (${res.status}).`);
  const json = await res.json();
  return (json?.data?.projects ?? []) as Project[];
}

/**
 * POST /api/pipeline/run — start a pipeline from a prompt + the chosen per-stage
 * models. The projects backend (Plan.md) doesn't exist yet, so we return an
 * optimistic Project so the run shows on the dashboard immediately; it won't
 * survive a refresh until the projects tables land. Watch the real run in the
 * Inngest dev dashboard.
 */
export async function createProject(input: StartPipelineInput): Promise<Project> {
  const overrides =
    input.overrides && Object.keys(input.overrides).length ? input.overrides : undefined;

  const res = await fetch(`${BACKEND_URL}/api/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      idea: input.prompt,
      defaultModelId: input.defaultModelId || undefined,
      overrides,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `Couldn't start the pipeline (${res.status}).`);
  }
  const json = await res.json();
  const pipelineId = (json?.data?.pipelineId as string) || crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id: pipelineId,
    title: input.prompt.length > 60 ? `${input.prompt.slice(0, 57)}…` : input.prompt,
    prompt: input.prompt,
    status: "running",
    currentStage: "request",
    createdAt: now,
    updatedAt: now,
  };
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
