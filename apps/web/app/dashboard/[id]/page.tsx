"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { authClient } from "../../_lib/auth-client";
import ThemeSwitch from "../../_components/theme-switch";
import {
  getProject,
  getClarifications,
  submitClarifications,
  approveProject,
  STAGES,
  relativeTime,
  type Project,
  type Stage,
  type Artifact,
  type Clarification,
  type StageType,
  type StageStatus,
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

function ArtifactViewer({ artifact }: { artifact: Artifact }) {
  const content = artifact.content as Record<string, unknown>;
  return (
    <div className="mt-3 rounded-xl border border-[var(--gray-alpha-200)] bg-[var(--background-200)] p-4">
      <pre className="overflow-x-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--gray-900)]">
        {JSON.stringify(content, null, 2)}
      </pre>
    </div>
  );
}

interface ClarificationsFormProps {
  clarifications: Clarification[];
  projectId: string;
  onSubmitted: () => void;
}

function ClarificationsForm({ clarifications, projectId, onSubmitted }: ClarificationsFormProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(clarifications.map((c) => [c.id, c.answer ?? ""]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = clarifications.every((c) => (answers[c.id] ?? "").trim().length > 0);

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitClarifications(
        projectId,
        clarifications.map((c) => ({ id: c.id, answer: answers[c.id] ?? "" }))
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
      className="mt-4 rounded-2xl border border-[var(--amber-700)] bg-[var(--background-100)] p-5"
      style={{ borderColor: "var(--amber-700)" }}
    >
      <p className="text-[13px] font-semibold text-[var(--amber-700)]">
        Help us understand your idea better
      </p>
      <p className="mt-1 text-[12px] text-[var(--gray-700)]">
        Answer these questions so the AI can build exactly what you have in mind.
      </p>

      <div className="mt-4 space-y-4">
        {clarifications.map((c, i) => (
          <div key={c.id}>
            <label className="block text-[13px] font-medium text-[var(--gray-1000)]">
              {i + 1}. {c.question}
            </label>
            <textarea
              rows={2}
              value={answers[c.id] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [c.id]: e.target.value }))}
              placeholder="Your answer…"
              className="mt-1.5 w-full resize-none rounded-lg border border-[var(--gray-alpha-300)] bg-[var(--field-background)] px-3 py-2 text-[13px] text-[var(--gray-1000)] placeholder:text-[var(--gray-600)] focus:border-[var(--gray-1000)] focus:outline-none"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-[12px] text-[var(--red-900)]">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => void handleSubmit()}
          disabled={!allAnswered || submitting}
          className="geist-btn geist-btn-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Sending…" : "Continue pipeline →"}
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

  // ── Loading / error states ─────────────────────────────────────────────
  if (loadingUser || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-100)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--gray-200)] border-t-[var(--gray-1000)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background-100)]">
        <p className="text-[15px] text-[var(--gray-700)]">Please sign in to view this project.</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background-100)]">
        <p className="text-[15px] font-medium text-[var(--gray-1000)]">Couldn't load project</p>
        <p className="text-[13px] text-[var(--gray-700)]">{error}</p>
        <Link href="/dashboard" className="geist-btn geist-btn-secondary">← Back to dashboard</Link>
      </div>
    );
  }

  const approvalStage = stages.find((s) => s.type === "approval");
  const showApproveButton = approvalStage?.status === "awaiting_input";

  const currentStageIndex = stages.findIndex(
    (s) => s.status === "running" || s.status === "awaiting_input"
  );

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--background-200)] text-[var(--gray-1000)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--gray-alpha-400)] bg-[var(--header-background)] backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-6">
          <Link href="/dashboard" className="text-[13px] text-[var(--gray-700)] hover:text-[var(--gray-1000)]">
            ← Dashboard
          </Link>
          <span className="text-[var(--gray-400)]">/</span>
          <span className="truncate text-[14px] font-semibold text-[var(--gray-1000)]">
            {project.title}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitch />
            <span
              className="rounded-full border border-[var(--gray-alpha-300)] px-2.5 py-1 text-[12px] font-medium"
              style={{ color: STATUS_COLOR[project.status as StageStatus] }}
            >
              {STATUS_LABEL[project.status as StageStatus] ?? project.status}
            </span>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
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
            ? `Stage ${currentStageIndex + 1} of 9`
            : project.status === "completed"
            ? "Pipeline complete"
            : "Starting pipeline…"}
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
                Ready for release?
              </p>
              <p className="mt-1 text-[13px] text-[var(--gray-700)]">
                The pipeline has completed all stages. Review the artifacts and approve to release.
              </p>
              <button
                onClick={() => void handleApprove()}
                disabled={approving}
                className="geist-btn geist-btn-primary mt-4 disabled:opacity-40"
              >
                {approving ? "Approving…" : "Approve & Release →"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pipeline stages */}
        <div className="mt-8 space-y-3">
          {STAGES.map((s) => {
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

        {project.status === "completed" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 rounded-2xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-6 text-center"
          >
            <p className="text-lg font-semibold" style={{ color: "var(--green-800)" }}>
              🎉 Pipeline complete
            </p>
            <p className="mt-1 text-[13px] text-[var(--gray-700)]">
              All 9 stages finished. Check the Release artifact for your summary.
            </p>
            <Link href="/dashboard" className="geist-btn geist-btn-secondary mt-4 inline-flex">
              ← Back to dashboard
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
}
