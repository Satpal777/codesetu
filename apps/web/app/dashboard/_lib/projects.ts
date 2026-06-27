const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

/** The nine pipeline stages, in order. */
export type StageType =
  | "request"
  | "product_thinking"
  | "prd"
  | "design"
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

/** A section of the AI-designed screen. Mirrors the backend LayoutSpec. */
export type LayoutSectionType =
  | "navbar"
  | "hero"
  | "form"
  | "features"
  | "gallery"
  | "list"
  | "cta"
  | "content"
  | "footer";

export interface LayoutSection {
  type: LayoutSectionType;
  title?: string | null;
  subtitle?: string | null;
  items?: string[] | null;
  cta?: string | null;
}

export interface LayoutSpec {
  screen: string;
  sections: LayoutSection[];
}

/** A file in the generated app (output of the implementation stage). */
export interface GeneratedFile {
  path: string;
  content: string;
}

function findFile(files: GeneratedFile[], name: string): GeneratedFile | undefined {
  const clean = name.replace(/^\.?\/+/, "");
  return files.find((f) => f.path.replace(/^\.?\/+/, "") === clean);
}

/**
 * Assemble the generated files into a single HTML document for the preview iframe,
 * inlining locally-referenced CSS and JS so relative paths resolve with no server.
 */
export function buildPreviewHtml(files: GeneratedFile[], entry = "index.html"): string {
  const entryFile = findFile(files, entry) ?? files.find((f) => f.path.endsWith(".html"));
  if (!entryFile) return "<!doctype html><title>Preview</title><p>No preview available.</p>";

  let html = entryFile.content;
  html = html.replace(/<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi, (m, href: string) => {
    const css = findFile(files, href);
    return css ? `<style>\n${css.content}\n</style>` : m;
  });
  html = html.replace(/<script[^>]*src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/gi, (m, src: string) => {
    const js = findFile(files, src);
    return js ? `<script>\n${js.content}\n</script>` : m;
  });
  return html;
}

export interface Clarification {
  id: string;
  projectId: string;
  question: string;
  /** AI-generated tap-to-answer choices. Null/empty = free-text only. */
  options?: string[] | null;
  /** Whether a "Something else" free-text escape hatch is offered. */
  allowCustom?: boolean;
  /** Whether the user may pick more than one option. */
  multiSelect?: boolean;
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
  autopilot?: boolean;
  deploymentUrl?: string | null;
  repoUrl?: string | null;
  repoBranch?: string | null;
  createdAt: string;
  updatedAt: string;
  stages?: Stage[];
  artifacts?: Artifact[];
  clarifications?: Clarification[];
}

/** The four human-facing "moments" a non-technical user actually experiences. */
export type MomentId = "idea" | "plan" | "build" | "launch";

/**
 * Friendly, jargon-free labels for each engine stage, grouped under the moment
 * the user sees. The backend stage `type`s never change — this is the face.
 */
export const STAGES: {
  type: StageType;
  label: string;
  description: string;
  moment: MomentId;
}[] = [
  { type: "request", label: "Understanding your idea", description: "A few quick questions", moment: "idea" },
  { type: "product_thinking", label: "Who it's for", description: "Who'll use it and why", moment: "plan" },
  { type: "prd", label: "What we'll build", description: "The plan, in plain words", moment: "plan" },
  { type: "design", label: "How it'll look", description: "A preview of the design", moment: "plan" },
  { type: "tasks", label: "The build checklist", description: "Breaking it into steps", moment: "build" },
  { type: "implementation", label: "Building your app", description: "Putting it together", moment: "build" },
  { type: "review", label: "Quality check", description: "Looking for rough edges", moment: "build" },
  { type: "fixes", label: "Polishing", description: "Smoothing things out", moment: "build" },
  { type: "approval", label: "Your sign-off", description: "Your turn to approve", moment: "launch" },
  { type: "release", label: "Going live", description: "Ready to share", moment: "launch" },
];

/** The four moments, in order, with their member stages. */
export const MOMENTS: { id: MomentId; label: string; blurb: string }[] = [
  { id: "idea", label: "Your idea", blurb: "Tell us what you want to make" },
  { id: "plan", label: "The plan", blurb: "What we'll build and who it's for" },
  { id: "build", label: "Building", blurb: "We put your app together" },
  { id: "launch", label: "Launch", blurb: "Review it and go live" },
];

export function stagesInMoment(moment: MomentId): StageType[] {
  return STAGES.filter((s) => s.moment === moment).map((s) => s.type);
}

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
  autopilot?: boolean;
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
      autopilot: input.autopilot ?? undefined,
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

/** POST /api/projects/:id/deploy — publish the generated app, returns the live URL. */
export async function deployProject(id: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${id}/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const json = (await res.json().catch(() => null)) as
    | { message?: string; data?: { url?: string } }
    | null;
  if (!res.ok || !json?.data?.url) {
    throw new Error(json?.message || `Couldn't publish (${res.status}).`);
  }
  return json.data.url;
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
