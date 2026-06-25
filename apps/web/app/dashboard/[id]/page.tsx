"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { authClient } from "../../_lib/auth-client";
import ThemeSwitch from "../../_components/theme-switch";
import AssemblyPanel from "../_components/assembly-panel";
import PreviewPanel from "../_components/preview-panel";
import {
  getProject,
  submitClarifications,
  approveProject,
  STAGES,
  MOMENTS,
  relativeTime,
  type Project,
  type Stage,
  type Artifact,
  type Clarification,
  type StageType,
  type StageStatus,
  type LayoutSpec,
  type GeneratedFile,
} from "../_lib/projects";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
const EASE = [0.175, 0.885, 0.32, 1.1] as const;

const STATUS_COLOR: Record<StageStatus, string> = {
  pending: "var(--gray-400)",
  running: "var(--blue-700)",
  awaiting_input: "var(--amber-700)",
  completed: "var(--green-800)",
  failed: "var(--red-900)",
};

const STATUS_BG: Record<StageStatus, string> = {
  pending: "var(--background-200)",
  running: "var(--background-100)",
  awaiting_input: "var(--background-100)",
  completed: "var(--background-100)",
  failed: "var(--background-100)",
};

const STATUS_LABEL: Record<StageStatus, string> = {
  pending: "Waiting",
  running: "Running…",
  awaiting_input: "Needs input",
  completed: "Done",
  failed: "Failed",
};

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "completed") return <span style={{ color: "var(--green-800)" }}>✓</span>;
  if (status === "running") return <span className="inline-block animate-spin" style={{ color: "var(--blue-700)" }}>⟳</span>;
  if (status === "awaiting_input") return <span style={{ color: "var(--amber-700)" }}>●</span>;
  if (status === "failed") return <span style={{ color: "var(--red-900)" }}>✕</span>;
  return <span style={{ color: "var(--gray-400)" }}>○</span>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gray-600)]">
      {children}
    </p>
  );
}

function Para({ label, value }: { label: string; value?: unknown }) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--gray-1000)]">{value}</p>
    </div>
  );
}

function BulletList({ label, items }: { label: string; items?: unknown }) {
  const strings = Array.isArray(items) ? (items.filter((i) => typeof i === "string") as string[]) : [];
  if (strings.length === 0) return null;
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <ul className="mt-1.5 space-y-1">
        {strings.map((s, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-[var(--gray-1000)]">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--gray-500)]" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NamedList({ label, items }: { label: string; items?: unknown }) {
  const rows = Array.isArray(items)
    ? (items.filter((i) => i && typeof i === "object") as Array<Record<string, unknown>>)
    : [];
  if (rows.length === 0) return null;
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-lg border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[var(--gray-1000)]">
                {String(r.name ?? r.title ?? `Item ${i + 1}`)}
              </p>
              {typeof r.priority === "string" && (
                <span className="shrink-0 rounded-full bg-[var(--background-200)] px-2 py-0.5 text-[11px] text-[var(--gray-700)]">
                  {r.priority}
                </span>
              )}
            </div>
            {typeof r.description === "string" && (
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--gray-700)]">{r.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicalDetails({ content }: { content: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] font-medium text-[var(--gray-600)] hover:text-[var(--gray-1000)]"
      >
        {open ? "Hide technical details" : "Show technical details"}
      </button>
      {open && (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-3 text-[11px] leading-relaxed text-[var(--gray-900)]">
          {JSON.stringify(content, null, 2)}
        </pre>
      )}
    </div>
  );
}

function StageCanvasPlaceholder() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)]">
      <div className="relative flex min-h-[340px] flex-col items-center justify-center px-6 py-16 text-center">
        <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]"
        />
        <div className="relative">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gray-alpha-300)] bg-[var(--background-200)]">
            <span className="text-lg">✦</span>
          </div>
          <p className="mt-4 text-[14px] font-medium text-[var(--gray-1000)]">Your app takes shape here</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-[var(--gray-600)]">
            Answer the questions and we&apos;ll design it, build it, and show it running — right here.
          </p>
        </div>
      </div>
    </div>
  );
}

function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  const c = (artifact.content ?? {}) as Record<string, unknown>;
  const wrap = (children: ReactNode) => (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--gray-alpha-200)] bg-[var(--background-200)] p-4">
      {children}
    </div>
  );

  switch (artifact.type) {
    case "product_thinking":
      return wrap(
        <>
          <Para label="In short" value={c.summary} />
          <Para label="The core value" value={c.coreValue} />
          <BulletList label="Who it's for" items={c.targetUsers} />
          <BulletList label="Things to watch" items={c.risks} />
        </>
      );
    case "prd":
      return wrap(
        <>
          <Para label="Overview" value={c.overview} />
          <NamedList label="What's included" items={c.features} />
          <BulletList label="Not doing (on purpose)" items={c.nonGoals} />
          <BulletList label="How we'll know it works" items={c.successMetrics} />
        </>
      );
    case "design": {
      const spec = (c.spec ?? {}) as { screen?: string };
      const svg = typeof c.imageSvg === "string" ? c.imageSvg : null;
      return wrap(
        <>
          {spec.screen && <Para label="Screen" value={spec.screen} />}
          {svg ? (
            <div>
              <FieldLabel>Preview</FieldLabel>
              <div
                className="mt-2 overflow-hidden rounded-lg border border-[var(--gray-alpha-200)] bg-white"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <p className="mt-1.5 text-[11px] text-[var(--gray-600)]">
                A preview of the layout. The real screens are built next.
              </p>
            </div>
          ) : (
            <TechnicalDetails content={c} />
          )}
        </>
      );
    }
    case "tasks":
      return wrap(<NamedList label="The build checklist" items={c.tasks} />);
    case "implementation": {
      const files = Array.isArray(c.files) ? (c.files as Array<{ path?: unknown }>) : [];
      if (files.length === 0) return wrap(<Para label="How we'll build it" value={c.outline} />);
      return wrap(
        <div>
          <FieldLabel>Files written</FieldLabel>
          <ul className="mt-1.5 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="font-mono text-[12px] text-[var(--gray-900)]">
                {typeof f.path === "string" ? f.path : `file ${i + 1}`}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-[var(--gray-600)]">See the live preview below.</p>
        </div>
      );
    }
    case "review":
      return wrap(
        <>
          <BulletList label="What we found" items={c.findings} />
          <BulletList label="Suggestions" items={c.suggestions} />
          <Para label="Risk level" value={c.riskLevel} />
        </>
      );
    case "fixes":
      return wrap(
        <>
          <Para label="In short" value={c.summary} />
          <BulletList label="What we improved" items={c.appliedFixes} />
        </>
      );
    case "release":
      return wrap(<Para label="Summary" value={c.summary} />);
    case "approval":
      return wrap(
        <p className="text-[13px] text-[var(--gray-700)]">Approved — thanks. Off we go.</p>
      );
    default:
      return wrap(<TechnicalDetails content={c} />);
  }
}

interface ClarificationsFormProps {
  clarifications: Clarification[];
  projectId: string;
  onSubmitted: () => void;
}

function ClarificationsForm({ clarifications, projectId, onSubmitted }: ClarificationsFormProps) {
  // Chosen option labels per question.
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  // Whether the "Something else" free-text box is active per question.
  const [customOn, setCustomOn] = useState<Record<string, boolean>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answerFor = (c: Clarification): string => {
    const picked = picks[c.id] ?? [];
    const noOptions = (c.options?.length ?? 0) === 0;
    const customActive = noOptions || (customOn[c.id] ?? false);
    const custom = customActive ? (customText[c.id] ?? "").trim() : "";
    if (c.multiSelect) return [...picked, custom].filter(Boolean).join(", ");
    return custom || picked[0] || "";
  };

  const allAnswered = clarifications.every((c) => answerFor(c).length > 0);

  const toggleOption = (c: Clarification, option: string) => {
    setPicks((prev) => {
      const current = prev[c.id] ?? [];
      if (c.multiSelect) {
        const next = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...prev, [c.id]: next };
      }
      return { ...prev, [c.id]: [option] };
    });
    // Picking a concrete option closes the free-text box on single-select.
    if (!c.multiSelect) setCustomOn((prev) => ({ ...prev, [c.id]: false }));
  };

  const toggleCustom = (c: Clarification) => {
    setCustomOn((prev) => ({ ...prev, [c.id]: !prev[c.id] }));
    if (!c.multiSelect) setPicks((prev) => ({ ...prev, [c.id]: [] }));
  };

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitClarifications(
        projectId,
        clarifications.map((c) => ({ id: c.id, answer: answerFor(c) }))
      );
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl border bg-[var(--background-100)] p-5"
      style={{ borderColor: "var(--amber-700)" }}
    >
      <p className="text-[13px] font-semibold text-[var(--amber-700)]">
        A couple of quick questions
      </p>
      <p className="mt-1 text-[12px] text-[var(--gray-700)]">
        Tap the answers that fit. There&apos;s no wrong choice — it just helps us build what you have in mind.
      </p>

      <div className="mt-4 space-y-5">
        {clarifications.map((c, i) => {
          const picked = picks[c.id] ?? [];
          const options = c.options ?? [];
          const noOptions = options.length === 0;
          const allowCustom = c.allowCustom !== false;
          const customActive = noOptions || (customOn[c.id] ?? false);
          return (
            <div key={c.id}>
              <p className="text-[13px] font-medium text-[var(--gray-1000)]">
                {i + 1}. {c.question}
                {c.multiSelect && (
                  <span className="ml-2 text-[11px] font-normal text-[var(--gray-600)]">
                    Pick any that apply
                  </span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((opt) => {
                  const active = picked.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleOption(c, opt)}
                      aria-pressed={active}
                      className={`press rounded-full border px-3 py-1.5 text-[13px] ${
                        active
                          ? "border-[var(--gray-1000)] bg-[var(--gray-1000)] font-medium text-[var(--background-100)]"
                          : "border-[var(--gray-alpha-300)] bg-[var(--background-100)] text-[var(--gray-1000)] hover:bg-[var(--background-200)]"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
                {allowCustom && !noOptions && (
                  <button
                    type="button"
                    onClick={() => toggleCustom(c)}
                    aria-pressed={customActive}
                    className={`press rounded-full border px-3 py-1.5 text-[13px] ${
                      customActive
                        ? "border-[var(--gray-1000)] bg-[var(--gray-1000)] font-medium text-[var(--background-100)]"
                        : "border-dashed border-[var(--gray-alpha-400)] bg-[var(--background-100)] text-[var(--gray-700)] hover:text-[var(--gray-1000)]"
                    }`}
                  >
                    Something else →
                  </button>
                )}
              </div>
              {customActive && (
                <input
                  autoFocus={!noOptions}
                  value={customText[c.id] ?? ""}
                  onChange={(e) =>
                    setCustomText((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  placeholder="Type your answer…"
                  className="mt-2 w-full rounded-lg border border-[var(--gray-alpha-300)] bg-[var(--field-background)] px-3 py-2 text-[13px] text-[var(--gray-1000)] placeholder:text-[var(--gray-600)] focus:border-[var(--gray-1000)] focus:outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-[12px] text-[var(--red-900)]">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button
          onClick={() => void handleSubmit()}
          disabled={!allAnswered || submitting}
          className="geist-btn geist-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Continue →"}
        </button>
      </div>
    </motion.div>
  );
}

interface StageCardProps {
  stage: Stage;
  artifact?: Artifact;
  isActive: boolean;
  clarifications?: Clarification[];
  projectId: string;
  onClarificationsSubmitted: () => void;
}

function StageCard({ stage, artifact, isActive, clarifications, projectId, onClarificationsSubmitted }: StageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = STAGES.find((s) => s.type === stage.type);
  const status = stage.status as StageStatus;
  const color = STATUS_COLOR[status];

  useEffect(() => {
    if (status === "running" || status === "awaiting_input" || status === "completed") {
      setExpanded(true);
    }
  }, [status]);

  const showClarifications =
    stage.type === "request" && status === "awaiting_input" && clarifications && clarifications.length > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="rounded-xl border bg-[var(--background-100)] overflow-hidden"
      style={{
        borderColor: isActive ? color : "var(--gray-alpha-200)",
        backgroundColor: STATUS_BG[status],
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[13px] font-bold">
          <StageIcon status={status} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[var(--gray-1000)] truncate">
              {meta?.label ?? stage.type}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color, backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--gray-600)]">{meta?.description}</p>
        </div>
        {(artifact || showClarifications) && (
          <span className="shrink-0 text-[12px] text-[var(--gray-600)]">
            {expanded ? "▲" : "▼"}
          </span>
        )}
        {status === "running" && (
          <span className="shrink-0">
            <span className="flex h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {showClarifications && (
                <ClarificationsForm
                  clarifications={clarifications!}
                  projectId={projectId}
                  onSubmitted={onClarificationsSubmitted}
                />
              )}
              {artifact && <ArtifactViewer artifact={artifact} />}
              {stage.error && (
                <p className="mt-3 text-[12px] text-[var(--red-900)]">Error: {stage.error}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ?? null;

  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Unwrap Next.js 16 async params
  useEffect(() => {
    void params.then((p) => setProjectId(p.id));
  }, [params]);

  const refreshProject = useCallback(async (id: string, signal?: AbortSignal) => {
    const proj = await getProject(id, signal);
    setProject(proj);
    setStages(proj.stages ?? []);
    setArtifacts(proj.artifacts ?? []);
    setClarifications(proj.clarifications ?? []);
  }, []);

  // Initial load
  useEffect(() => {
    if (!projectId || !user) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    refreshProject(projectId, controller.signal)
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [projectId, user, refreshProject]);

  // SSE for live stage updates
  useEffect(() => {
    if (!projectId || !user) return;

    const es = new EventSource(`${BACKEND_URL}/api/projects/${projectId}/stream`, {
      withCredentials: true,
    });
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const update = JSON.parse(e.data as string) as {
          stage: string;
          status: string;
          artifact?: unknown;
        };

        // Update the stage in local state
        setStages((prev) =>
          prev.map((s) =>
            s.type === update.stage
              ? {
                  ...s,
                  status: update.status as StageStatus,
                  ...(update.status === "running" ? { startedAt: new Date().toISOString() } : {}),
                  ...(update.status === "completed" ? { completedAt: new Date().toISOString() } : {}),
                }
              : s
          )
        );

        // Update project status
        if (update.status === "awaiting_input" || update.status === "completed" || update.status === "running") {
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  status: (update.status === "completed" && update.stage === "release"
                    ? "completed"
                    : update.status === "awaiting_input"
                    ? "awaiting_input"
                    : "running") as typeof prev.status,
                  currentStage: update.stage as StageType,
                  updatedAt: new Date().toISOString(),
                }
              : prev
          );
        }

        // When a stage completes, refresh to get the new artifact from DB
        if (update.status === "completed" || update.status === "awaiting_input") {
          void refreshProject(projectId).catch(() => null);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; no action needed
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [projectId, user, refreshProject]);

  const handleApprove = async () => {
    if (!projectId || approving) return;
    setApproving(true);
    try {
      await approveProject(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleClarificationsSubmitted = () => {
    if (projectId) void refreshProject(projectId).catch(() => null);
  };

  const approvalStage = stages.find((s) => s.type === "approval");
  const showApproveButton = approvalStage?.status === "awaiting_input";

  const currentStageIndex = stages.findIndex(
    (s) => s.status === "running" || s.status === "awaiting_input"
  );
  const currentMeta =
    currentStageIndex >= 0
      ? STAGES.find((s) => s.type === stages[currentStageIndex]?.type)
      : undefined;

  const designSpec = (
    artifacts.find((a) => a.type === "design")?.content as { spec?: LayoutSpec } | undefined
  )?.spec;

  const implContent = artifacts.find((a) => a.type === "implementation")?.content as
    | { entry?: string; files?: GeneratedFile[] }
    | undefined;
  const generatedFiles = implContent?.files ?? [];
  const previewEntry = implContent?.entry ?? "index.html";

  // Only block the full page on the very first session+project load.
  // Background session refetches must NOT unmount ThemeSwitch.
  const isInitialSessionLoad = loadingUser && !user;
  const isProjectLoading = !loadingUser && user && loading;
  const isNotLoggedIn = !loadingUser && !user;
  const isError = !loadingUser && user && !loading && (!!error || !project);
  const showProject = !loadingUser && !!user && !loading && !error && !!project;

  return (
    <div className={`min-h-screen ${showProject ? "bg-[var(--background-200)]" : "bg-[var(--background-100)]"} text-[var(--gray-1000)]`}>

      {/* ─── Persistent header — ThemeSwitch lives here and never remounts ─── */}
      <header className="sticky top-0 z-40 border-b border-[var(--gray-alpha-400)] bg-[var(--header-background)] backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <Link href="/dashboard" className="text-[13px] text-[var(--gray-700)] hover:text-[var(--gray-1000)]">
            ← Dashboard
          </Link>
          {project && (
            <>
              <span className="text-[var(--gray-400)]">/</span>
              <span className="truncate text-[14px] font-semibold text-[var(--gray-1000)]">
                {project.title}
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitch />
            {project && (
              <span
                className="rounded-full border border-[var(--gray-alpha-300)] px-2.5 py-1 text-[12px] font-medium"
                style={{ color: STATUS_COLOR[project.status as StageStatus] }}
              >
                {STATUS_LABEL[project.status as StageStatus] ?? project.status}
              </span>
            )}
          </div>
        </nav>
      </header>

      {/* ─── Loading: session not yet known → full-page spinner ─── */}
      {isInitialSessionLoad && (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--gray-200)] border-t-[var(--gray-1000)]" />
        </div>
      )}

      {/* ─── Loading: user known but project data not yet arrived → skeleton ─── */}
      {isProjectLoading && (
        <main className="mx-auto max-w-4xl px-6 py-10">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-[var(--gray-100)]" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-[var(--gray-100)]" />
          <div className="mt-6 flex gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-1.5 flex-1 animate-pulse rounded-full bg-[var(--gray-100)]" />
            ))}
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-4">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-pulse rounded-full bg-[var(--gray-100)]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 animate-pulse rounded bg-[var(--gray-100)]" />
                    <div className="h-3 w-48 animate-pulse rounded bg-[var(--gray-100)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ─── Not logged in ─── */}
      {isNotLoggedIn && (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <p className="text-[15px] text-[var(--gray-700)]">Please sign in to view this project.</p>
        </div>
      )}

      {/* ─── Error / project not found ─── */}
      {isError && (
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <p className="text-[15px] font-medium text-[var(--gray-1000)]">Couldn't load project</p>
          <p className="text-[13px] text-[var(--gray-700)]">{error}</p>
          <Link href="/dashboard" className="geist-btn geist-btn-secondary">← Back to dashboard</Link>
        </div>
      )}

      {/* ─── Project detail ─── */}
      {showProject && project && (
      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Project meta */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{project.title}</h1>
          <p className="mt-1 text-[14px] text-[var(--gray-700)]">{project.prompt}</p>
          <p className="mt-1 text-[12px] text-[var(--gray-600)]">
            Started {relativeTime(project.createdAt)}
            {project.updatedAt !== project.createdAt && ` · Updated ${relativeTime(project.updatedAt)}`}
          </p>
        </motion.div>

        {/* Progress bar */}
        <div className="mt-6 flex gap-1">
          {STAGES.map((s, i) => {
            const dbStage = stages.find((st) => st.type === s.type);
            const status = (dbStage?.status ?? "pending") as StageStatus;
            return (
              <div
                key={s.type}
                className="h-1.5 flex-1 rounded-full transition-colors duration-500"
                style={{ backgroundColor: STATUS_COLOR[status] }}
                title={s.label}
              />
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-[var(--gray-600)]">
          {currentStageIndex >= 0
            ? `Step ${currentStageIndex + 1} of ${STAGES.length}${currentMeta ? ` · ${currentMeta.label}` : ""}`
            : project.status === "completed"
            ? "All done"
            : "Getting started…"}
        </p>

        {/* Approval banner */}
        <AnimatePresence>
          {showApproveButton && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="mt-6 rounded-2xl border p-5 text-center"
              style={{ borderColor: "var(--amber-700)", backgroundColor: "color-mix(in srgb, var(--amber-700) 6%, var(--background-100))" }}
            >
              <p className="text-[15px] font-semibold" style={{ color: "var(--amber-700)" }}>
                Ready to go live?
              </p>
              <p className="mt-1 text-[13px] text-[var(--gray-700)]">
                We&apos;ve finished building. Take a look below, then give it the thumbs-up.
              </p>
              <button
                onClick={() => void handleApprove()}
                disabled={approving}
                className="geist-btn geist-btn-primary mt-4 disabled:opacity-40"
              >
                {approving ? "Publishing…" : "Looks good — go live →"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Studio: the live result (hero, left) beside the pipeline rail (right). */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* The stage — the app as it comes to life. Sticky on desktop. */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {generatedFiles.length > 0 ? (
              <PreviewPanel
                projectId={project.id}
                files={generatedFiles}
                entry={previewEntry}
                initialDeploymentUrl={project.deploymentUrl}
              />
            ) : designSpec && designSpec.sections?.length > 0 ? (
              <AssemblyPanel spec={designSpec} stages={stages} projectStatus={project.status} />
            ) : (
              <StageCanvasPlaceholder />
            )}
          </div>

          {/* The rail — the steps, top to bottom. */}
          <div className="space-y-8">
            {MOMENTS.map((moment, mi) => (
              <section key={moment.id} className="animate-rise" style={{ animationDelay: `${mi * 60}ms` }}>
                <div className="mb-3 flex items-baseline gap-2">
                  <h2 className="text-[15px] font-semibold text-[var(--gray-1000)]">{moment.label}</h2>
                  <span className="text-[12px] text-[var(--gray-600)]">{moment.blurb}</span>
                </div>
                <div className="space-y-3">
                  {STAGES.filter((s) => s.moment === moment.id).map((s) => {
                    const dbStage = stages.find((st) => st.type === s.type) ?? {
                      id: s.type,
                      projectId: project.id,
                      type: s.type,
                      status: "pending" as StageStatus,
                      order: 0,
                    };
                    const artifact = artifacts.find((a) => a.type === s.type);
                    const isActive =
                      dbStage.status === "running" || dbStage.status === "awaiting_input";

                    return (
                      <StageCard
                        key={s.type}
                        stage={dbStage as Stage}
                        artifact={artifact}
                        isActive={isActive}
                        clarifications={s.type === "request" ? clarifications : undefined}
                        projectId={project.id}
                        onClarificationsSubmitted={handleClarificationsSubmitted}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {project.status === "completed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-6 text-center"
          >
            <p className="text-lg font-semibold" style={{ color: "var(--green-800)" }}>
              🎉 Your app is ready
            </p>
            <p className="mt-1 text-[13px] text-[var(--gray-700)]">
              Everything&apos;s built. Open the “Going live” step above to see the summary.
            </p>
            <Link href="/dashboard" className="geist-btn geist-btn-secondary mt-4 inline-flex">
              ← Back to dashboard
            </Link>
          </motion.div>
        )}
      </main>
      )}
    </div>
  );
}
