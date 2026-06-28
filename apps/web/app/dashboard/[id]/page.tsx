"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../_lib/auth-client";
import AssemblyPanel from "../_components/assembly-panel";
import AgentWorkspace from "./_components/agent-workspace";
import ThemeToggle from "../../_components/theme-toggle";
import {
  getProject,
  getShareUrl,
  submitClarifications,
  approveProject,
  relativeTime,
  type Project,
  type Stage,
  type Artifact,
  type Clarification,
  type StageType,
  type StageStatus,
  type LayoutSpec,
} from "../_lib/projects";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
const EASE = [0.2, 0, 0, 1] as const;

const STAGE_METADATA: Record<StageType, { name: string; desc: string }> = {
  request: { name: "Idea Formulation", desc: "Capturing and structuring your core app concept" },
  product_thinking: { name: "User Profiling", desc: "Defining target users, core values, and risks" },
  prd: { name: "Product Specification", desc: "Writing features, non-goals, and success metrics" },
  design: { name: "Interface Design", desc: "Planning layout sections and mockup visualization" },
  tasks: { name: "Task Breakdown", desc: "Deconstructing specs into ordered build checklists" },
  implementation: { name: "Source Code Generation", desc: "Generating files, structures, and assets" },
  review: { name: "Quality Assurance", desc: "Scanning code for accessibility, bugs, and edge cases" },
  fixes: { name: "Polishing & Optimization", desc: "Applying suggestions and refining performance" },
  approval: { name: "Release Verification", desc: "Final verification and approval to deploy" },
  release: { name: "Production Deployment", desc: "Packaging, publishing, and going live on Vercel" },
};

const STAGE_ORDER: StageType[] = [
  "request",
  "product_thinking",
  "prd",
  "design",
  "tasks",
  "implementation",
  "review",
  "fixes",
  "approval",
  "release",
];

const STAGE_LOGS: Record<StageType, string[]> = {
  request: ["Analyzing your project prompt...", "Extracting core design parameters...", "Preparing clarification queries..."],
  product_thinking: ["Identifying key user personas...", "Analyzing target demographic requirements...", "Mapping core value propositions...", "Evaluating edge-case usage risks..."],
  prd: ["Drafting product specification documentation...", "Defining system scope & feature list...", "Setting out of scope boundaries...", "Structuring technical architecture..."],
  design: ["Creating grid layouts...", "Structuring application layout sections...", "Assigning section design components...", "Drafting layout JSON spec..."],
  tasks: ["Estimating build phases...", "Generating checklist of development items...", "Sequencing coding priorities..."],
  implementation: ["Spawning Daytona build workspace...", "Generating root files (index.html, styles.css)...", "Writing custom styling sheets...", "Bundling local dependencies..."],
  review: ["Scanning file accessibility standards...", "Verifying contrast ratio compliance...", "Testing markup semantic syntax...", "Running debug checks..."],
  fixes: ["Applying style sheet polish...", "Aligning margins and padding...", "Optimizing hover states...", "Running final package build..."],
  approval: ["Verifying sandbox build output...", "Awaiting deployment approval..."],
  release: ["Packaging files for cloud build...", "Deploying build assets to Vercel...", "Mapping production domains...", "Activating secure sandboxed preview URL..."],
};

const DEFAULT_SPEC: LayoutSpec = {
  screen: "Landing page",
  sections: [
    { type: "navbar", items: ["Home", "Features", "Pricing"], cta: "Join" },
    { type: "hero", title: "Building your application...", subtitle: "Please wait while CodeSetu generates your custom codebase.", cta: "Build active" },
    { type: "features", title: "AI Generation Pipeline", items: ["Fast compilation", "Daytona Sandboxing", "Strict Accessibility"] },
    { type: "cta", title: "Ready to preview?", cta: "Previewing" },
    { type: "footer", items: ["About", "Contact", "Privacy"] },
  ],
};

// ══ 1. Conversational Chat-Based Onboarding ══
interface ConversationalClarificationsProps {
  clarifications: Clarification[];
  projectId: string;
  onSubmitted: () => void;
}

function ConversationalClarifications({
  clarifications,
  projectId,
  onSubmitted,
}: ConversationalClarificationsProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [history, setHistory] = useState<{ role: "bot" | "user"; text: string }[]>([]);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [customText, setCustomText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeQuestion = clarifications[currentIdx];

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Load first question
  useEffect(() => {
    if (clarifications.length > 0 && history.length === 0) {
      setHistory([{ role: "bot", text: clarifications[0]?.question ?? "" }]);
    }
  }, [clarifications, history.length]);

  const handleSelectOption = async (option: string) => {
    if (submitting) return;

    const q = clarifications[currentIdx];
    if (!q) return;
    const newPicks = { ...picks, [q.id]: [option] };
    setPicks(newPicks);

    const updatedHistory = [...history, { role: "user" as const, text: option }];
    setHistory(updatedHistory);

    if (currentIdx + 1 < clarifications.length) {
      const nextQ = clarifications[currentIdx + 1];
      if (!nextQ) return;
      setCurrentIdx((prev) => prev + 1);
      setHistory([...updatedHistory, { role: "bot" as const, text: nextQ.question }]);
    } else {
      await submitAll(newPicks);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || submitting) return;

    const answer = customText.trim();
    setCustomText("");

    const q = clarifications[currentIdx];
    if (!q) return;
    const newPicks = { ...picks, [q.id]: [answer] };
    setPicks(newPicks);

    const updatedHistory = [...history, { role: "user" as const, text: answer }];
    setHistory(updatedHistory);

    if (currentIdx + 1 < clarifications.length) {
      const nextQ = clarifications[currentIdx + 1];
      if (!nextQ) return;
      setCurrentIdx((prev) => prev + 1);
      setHistory([...updatedHistory, { role: "bot" as const, text: nextQ.question }]);
    } else {
      await submitAll(newPicks);
    }
  };

  const submitAll = async (allPicks: Record<string, string[]>) => {
    setSubmitting(true);
    setError(null);
    try {
      const answers = clarifications.map((c) => ({
        id: c.id,
        answer: (allPicks[c.id] ?? []).join(", "),
      }));
      await submitClarifications(projectId, answers);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-sm overflow-hidden max-w-xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] px-5 py-3 bg-[var(--bg-raised)]">
        <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
          Step 1 of 2 · Chat Onboarding
        </p>
        <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
          Shaping your application
        </h3>
      </div>

      {/* Chat Window */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {history.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              className={`flex gap-2.5 w-full animate-[msgIn_0.2s_ease] ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {!isUser && (
                <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[3px] bg-[var(--ink-950)] text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M3 16 Q12 4 21 16" />
                    <line x1="12" y1="9" x2="12" y2="20" />
                  </svg>
                </div>
              )}

              <div className="flex flex-col gap-1 max-w-[80%]">
                {!isUser && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    CodeSetu
                  </span>
                )}
                <div
                  className={`text-[13px] leading-relaxed ${
                    isUser
                      ? "rounded-[12px_12px_2px_12px] bg-[var(--fill-muted)] px-3.5 py-2 text-[var(--text-primary)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Actions & Custom Suggestion Inputs */}
      {activeQuestion && (
        <div className="border-t border-[var(--border-subtle)] p-3 bg-[var(--bg-inset)]">
          {/* Options grid */}
          {activeQuestion.options && activeQuestion.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {activeQuestion.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => void handleSelectOption(opt)}
                  disabled={submitting}
                  className="press cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--fill-muted)] disabled:opacity-40"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Suggestion input field (last option as input) */}
          {activeQuestion.allowCustom !== false && (
            <form onSubmit={handleCustomSubmit} className="flex gap-2 items-center">
              <input
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={submitting}
                placeholder="Type a custom suggestion or answer..."
                className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-1.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={submitting || !customText.trim()}
                className="cs-btn cs-btn-sm cs-btn-solid font-semibold disabled:opacity-40 shrink-0"
              >
                {submitting ? "..." : "Send"}
              </button>
            </form>
          )}

          {error && <p className="mt-2 text-[11px] text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ══ 2. Stage Logging Console (See what's going on) ══
function StageLogVisualizer({ activeStage }: { activeStage: StageType }) {
  const [logIndex, setLogIndex] = useState(0);
  const logs = STAGE_LOGS[activeStage] || ["Working on stage task..."];

  useEffect(() => {
    setLogIndex(0);
    const interval = setInterval(() => {
      setLogIndex((i) => (i + 1) % logs.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [activeStage]);

  return (
    <div className="flex flex-col gap-3 font-mono text-[12px] text-[var(--text-secondary)]">
      <div className="flex items-center gap-2">
        <svg className="animate-spin h-3.5 w-3.5 text-[var(--text-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <circle className="opacity-25" cx="12" cy="12" r="10" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="font-semibold text-[var(--text-primary)]">{logs[logIndex]}</span>
      </div>
      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3.5 space-y-1 text-[11px] text-[var(--text-tertiary)]">
        <div>&gt; task_runner_init: {activeStage}</div>
        <div>&gt; env_sandbox: daytona_container_host</div>
        <div>&gt; container_status: compiling</div>
        <div>&gt; trace_log: pipeline step active...</div>
      </div>
    </div>
  );
}

// ══ 3. Simple Progress View (for non-developer users) ══
function SimpleProgressView({ activeStageIndex, totalStages, activeStageType }: {
  activeStageIndex: number;
  totalStages: number;
  activeStageType: StageType;
}) {
  const FRIENDLY_LABELS: Record<StageType, string> = {
    request: "Understanding your idea…",
    product_thinking: "Thinking through your users…",
    prd: "Writing out what to build…",
    design: "Sketching the layout…",
    tasks: "Planning the build steps…",
    implementation: "Writing your app…",
    review: "Checking for issues…",
    fixes: "Polishing…",
    approval: "Almost ready to go live…",
    release: "Deploying to the web…",
  };

  const pct = Math.round(((activeStageIndex + 1) / totalStages) * 100);

  return (
    <div className="mx-auto max-w-lg w-full px-6 py-20 flex flex-col items-center gap-6">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--bg-inset)] border-t-[var(--ink-950)]" />
      <div className="w-full text-center">
        <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
          {FRIENDLY_LABELS[activeStageType] ?? "Building your app…"}
        </p>
        <p className="font-mono text-[11px] text-[var(--text-tertiary)]">{pct}% complete</p>
      </div>
      <div className="h-[3px] w-full max-w-xs bg-[var(--bg-inset)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--ink-950)] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)] text-center max-w-xs">
        Your app is being built in the background — we'll switch you to the live editor as soon as it's ready.
      </p>
    </div>
  );
}

// ══ 4. Copy Share Button ══
function CopyShareButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = getShareUrl(token);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="cs-btn cs-btn-sm cs-btn-outline border-[var(--ink-700)] text-white hover:bg-[var(--ink-800)] gap-1.5"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Share link
        </>
      )}
    </button>
  );
}

// ══ 5. Project Detail Page Controller ══
export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ?? null;
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const [devMode, setDevMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("cs_dev_mode") === "true";
  });

  const toggleDevMode = () => {
    setDevMode((prev) => {
      const next = !prev;
      localStorage.setItem("cs_dev_mode", String(next));
      return next;
    });
  };

  // Unwrap Next.js async params
  useEffect(() => {
    void params.then((p) => setProjectId(p.id));
  }, [params]);

  // Project detail query
  const {
    data: project,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => getProject(projectId!, signal),
    enabled: !!projectId && !!user,
    staleTime: 0,
  });

  const stages = project?.stages ?? [];
  const artifacts = project?.artifacts ?? [];
  const clarifications = project?.clarifications ?? [];

  // Approve project mutation (moves to deploy)
  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: () => approveProject(projectId!),
    onError: (err) => console.error(err),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  // SSE handler for project updates
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

        queryClient.setQueryData<Project>(["project", projectId], (prev) => {
          if (!prev) return prev;

          const updatedStages = (prev.stages ?? []).map((s) =>
            s.type === update.stage
              ? {
                  ...s,
                  status: update.status as StageStatus,
                  ...(update.status === "running" ? { startedAt: new Date().toISOString() } : {}),
                  ...(update.status === "completed" ? { completedAt: new Date().toISOString() } : {}),
                }
              : s
          );

          const newProjectStatus =
            update.status === "completed" && update.stage === "release"
              ? "completed"
              : update.status === "awaiting_input"
              ? "awaiting_input"
              : "running";

          return {
            ...prev,
            stages: updatedStages,
            ...(["awaiting_input", "completed", "running"].includes(update.status)
              ? {
                  status: newProjectStatus as Project["status"],
                  currentStage: update.stage as StageType,
                  updatedAt: new Date().toISOString(),
                }
              : {}),
          };
        });

        if (update.status === "completed" || update.status === "awaiting_input") {
          void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
        }
      } catch {
        // ignore errors
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [projectId, user, queryClient]);

  const handleClarificationsSubmitted = () => {
    void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const isInitialSessionLoad = loadingUser && !user;
  const isProjectLoading = !loadingUser && user && isLoading;
  const isNotLoggedIn = !loadingUser && !user;
  const hasError = !loadingUser && user && !isLoading && (isError || !project);
  const showProject = !loadingUser && !!user && !isLoading && !isError && !!project;

  // Stages & Gates status
  const requestStage = stages.find((s) => s.type === "request");
  const showClarifications =
    requestStage?.status === "awaiting_input" && clarifications && clarifications.length > 0;

  const approvalStage = stages.find((s) => s.type === "approval");
  const showDeployGate = approvalStage?.status === "awaiting_input";

  const buildDone = project?.status === "completed";
  const activeStageType = project?.currentStage ?? "request";
  const activeStageIndex = STAGE_ORDER.indexOf(activeStageType);

  // Load layout design spec if available
  const designArtifact = artifacts.find((a) => a.type === "design");
  let layoutSpec: LayoutSpec = DEFAULT_SPEC;
  if (designArtifact) {
    try {
      const parsed = typeof designArtifact.content === "string"
        ? JSON.parse(designArtifact.content)
        : designArtifact.content;
      if (parsed && typeof parsed === "object" && "sections" in parsed) {
        layoutSpec = parsed as LayoutSpec;
      }
    } catch {
      // fallback
    }
  }

  // Active artifact content for visualization
  const activeArtifact = artifacts.find((a) => a.type === activeStageType);

  if (isInitialSessionLoad) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ink-200)] border-t-[var(--ink-950)]" />
      </div>
    );
  }

  if (isProjectLoading) {
    return (
      <main className="mx-auto max-w-[580px] px-6 py-14">
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--bg-inset)] mb-4" />
        <div className="h-7 w-56 animate-pulse rounded bg-[var(--bg-inset)] mb-10" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 items-center h-12">
              <div className="h-8 w-8 rounded animate-pulse bg-[var(--bg-inset)] shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 animate-pulse rounded bg-[var(--bg-inset)]" />
                <div className="h-3 w-48 animate-pulse rounded bg-[var(--bg-inset)]" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (isNotLoggedIn) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-[14px] text-[var(--text-secondary)]">Please sign in to view this project.</p>
      </div>
    );
  }

  if (hasError || !project) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-[14px] font-semibold text-[var(--text-primary)]">Project not found</p>
        <p className="text-[12px] text-[var(--text-secondary)]">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        <Link href="/dashboard" className="cs-btn cs-btn-sm cs-btn-outline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  // Active status header details
  const buildStatusLine = buildDone
    ? `${project.title.toLowerCase().replace(/[^a-z0-9-]/g, "") || "project"}.codesetu.app`
    : `Stage ${Math.min(activeStageIndex + 1, STAGE_ORDER.length)} of ${STAGE_ORDER.length} · ${
        STAGE_METADATA[activeStageType]?.name ?? activeStageType
      }`;

  const buildBadgeLabel = buildDone ? "Live" : showDeployGate ? "Review" : "Building";

  return (
    <div className="flex flex-col min-h-full bg-[var(--bg-base)]">
      {/* Header bar */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-raised)] px-6">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 font-sans text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M19 12H5" />
              <path d="m12 5-7 7 7 7" />
            </svg>
            Dashboard
          </Link>
          <div className="h-3.5 w-[1px] bg-[var(--border-default)]" />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{project.title}</div>
            <div className="font-mono text-[10px] tracking-wide text-[var(--text-tertiary)] mt-0.5">{buildStatusLine}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleDevMode}
            title={devMode ? "Switch to simple view" : "Switch to developer view"}
            className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              devMode
                ? "border-[var(--border-strong)] bg-[var(--ink-950)] text-white"
                : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Dev
          </button>
          <ThemeToggle />
          <span
            className={`cs-badge text-[11px] uppercase tracking-wider font-semibold border ${
              buildDone
                ? "border-[var(--border-strong)] bg-[var(--ink-950)] text-white font-bold"
                : "border-[var(--border-default)] text-[var(--text-secondary)]"
            }`}
          >
            <span className={`cs-badge-dot ${buildDone ? "bg-green-500" : "bg-[var(--ink-400)] animate-pulse"}`} />
            {buildBadgeLabel}
          </span>
        </div>
      </div>

      <div className="flex-1">
        {buildDone ? (
          /* ══ Completed View: Paid payoff and Live Sandboxed preview ══ */
          <div className="flex flex-col h-full">
            <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="rounded border border-[var(--border-strong)] bg-[var(--surface-invert)] p-6 shadow-md text-white"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--ink-300)] mb-2">
                  ↗ Live in Daytona Sandbox
                </div>
                <h2 className="cs-display text-[26px] tracking-tight leading-none mb-1 text-white">
                  {project.title} is live.
                </h2>
                {project.deploymentUrl && (
                  <p className="font-mono text-[12px] text-[var(--ink-200)] mb-5">
                    {project.deploymentUrl.replace(/^https?:\/\//, "")}
                  </p>
                )}
                <div className="flex gap-2">
                  {project.deploymentUrl && (
                    <a
                      href={project.deploymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cs-btn cs-btn-sm cs-btn-solid bg-white text-[var(--ink-950)] border-white hover:bg-[var(--ink-100)] font-semibold"
                    >
                      Open site →
                    </a>
                  )}
                  {project.shareToken && (
                    <CopyShareButton token={project.shareToken} />
                  )}
                  <Link href="/dashboard" className="cs-btn cs-btn-sm cs-btn-outline border-[var(--ink-700)] text-white hover:bg-[var(--ink-800)]">
                    Back to dashboard
                  </Link>
                </div>
              </motion.div>
            </div>

            <div className="flex-1 px-6 pb-10">
              <div className="mx-auto w-full max-w-6xl">
                <AgentWorkspace projectId={project.id} projectTitle={project.title} shareToken={project.shareToken} />
              </div>
            </div>
          </div>
        ) : showClarifications ? (
          /* ══ Onboarding: Conversational Chat-based questions ══ */
          <div className="px-6 py-14">
            <ConversationalClarifications
              clarifications={clarifications}
              projectId={project.id}
              onSubmitted={handleClarificationsSubmitted}
            />
          </div>
        ) : (
          /* ══ Active Build: Progress or full stage checklist ══ */
          <div className="flex-1">
            {devMode ? (
              /* Developer mode — full SDLC stage checklist + log visualizer */
              <div className="mx-auto w-full max-w-6xl px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2.2fr] gap-8 items-start">
              
              {/* Left column: Stages checklist */}
              <div className="rounded border border-[var(--border-default)] bg-[var(--bg-raised)] p-5 shadow-sm">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-5">
                  Stages Checklist
                </div>

                <div className="flex flex-col">
                  {STAGE_ORDER.map((type, i) => {
                    const stage = stages.find((s) => s.type === type);
                    const metadata = STAGE_METADATA[type];

                    const done = (stage && stage.status === "completed") || i < activeStageIndex;
                    const running = i === activeStageIndex && stage?.status === "running";
                    const gate = i === activeStageIndex && stage?.status === "awaiting_input";
                    const pending = !done && !running && !gate;

                    let indText = "";
                    let indClass = "";

                    if (done) {
                      indText = "✓";
                      indClass = "bg-[var(--ink-950)] border-[var(--ink-950)] text-white font-bold rounded";
                    } else if (running) {
                      indClass = "border-t-[var(--ink-950)] border-r-[var(--border-default)] border-b-[var(--border-default)] border-l-[var(--border-default)] animate-spin rounded-full";
                    } else {
                      indText = String(i + 1).padStart(2, "0");
                      indClass = `font-mono text-[10px] font-semibold border rounded ${
                        gate ? "border-[var(--border-strong)] text-[var(--text-primary)] animate-pulse" : "border-[var(--border-default)] text-[var(--text-disabled)]"
                      }`;
                    }

                    return (
                      <div key={type} className="flex flex-col">
                        <div
                          className={`flex items-center gap-3 py-3 border-b border-[var(--border-subtle)] transition-opacity duration-300 ${
                            pending ? "opacity-35" : "opacity-100"
                          }`}
                        >
                          <div className={`flex h-7 w-7 items-center justify-center shrink-0 border-[1.5px] ${indClass}`}>
                            {indText}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-[13px] leading-tight ${
                                done || running || gate ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-disabled)]"
                              }`}
                            >
                              {metadata.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {done && ["product_thinking", "prd", "tasks"].includes(type) && (
                              <a
                                href={`${BACKEND_URL}/api/projects/${project.id}/preview/docs/${
                                  type === "product_thinking" ? "USER_PROFILES.html" : type === "prd" ? "PRD.html" : "TASKS.html"
                                }`}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className="font-sans text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] rounded px-2.5 py-0.5 bg-[var(--bg-raised)] font-medium transition-colors cursor-pointer"
                              >
                                ↓ Download
                              </a>
                            )}
                            <span
                              className={`font-mono text-[10.5px] tracking-wide ${
                                done
                                  ? "text-[var(--text-tertiary)]"
                                  : running
                                  ? "text-[var(--text-primary)] font-semibold"
                                  : gate
                                  ? "text-[var(--border-strong)] font-semibold"
                                  : "text-transparent"
                              }`}
                            >
                              {done ? "Done" : running ? "Running" : gate ? "Awaiting" : ""}
                            </span>
                          </div>
                        </div>

                        {/* Inline final deployment gate */}
                        {gate && type === "approval" && showDeployGate && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="my-3 ml-10 border border-[var(--border-strong)] rounded bg-white p-4 shadow-sm"
                          >
                            <div className="text-[12px] font-bold mb-1">
                              Deploy to production?
                            </div>
                            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mb-3">
                              App verified in preview and ready to ship to public.
                            </p>
                            <button
                              onClick={() => approve()}
                              disabled={approving}
                              className="cs-btn cs-btn-sm cs-btn-solid font-semibold disabled:opacity-40 text-[11px]"
                            >
                              {approving ? "Deploying..." : "Deploy now"}
                            </button>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right column: Dynamic build visualizer / logs */}
              <div className="flex flex-col gap-4">
                
                {/* Visualizer Frame */}
                <div className="rounded border border-[var(--border-default)] bg-white shadow-sm overflow-hidden flex flex-col min-h-[460px]">
                  
                  {/* Browser chrome headers */}
                  <div className="flex h-10 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-inset)] px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-default)]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-default)]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-default)]" />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {["implementation", "review", "fixes", "approval", "release"].includes(activeStageType) && (
                        <a
                          href={`${BACKEND_URL}/api/projects/${project.id}/preview/`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-sans text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                        >
                          Open in new tab ↗
                        </a>
                      )}
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)] tracking-wider uppercase">
                        {activeStageType === "implementation" || activeStageType === "review" || activeStageType === "fixes"
                          ? "APPLICATION ASSEMBLY"
                          : `${activeStageType} ARTIFACT`}
                      </span>
                    </div>
                  </div>

                  {/* Visualizer content body */}
                  <div className="flex-1 p-0 overflow-hidden">
                    {/* Render live sandbox preview iframe during implementation, review, fixes, approval, or release stages */}
                    {["implementation", "review", "fixes", "approval", "release"].includes(activeStageType) ? (
                      <div className="w-full h-[500px] bg-white relative">
                        <iframe
                          src={`${BACKEND_URL}/api/projects/${project.id}/preview/?t=${new Date(project.updatedAt).getTime()}`}
                          className="w-full h-[500px] bg-white border-0 block"
                          title="Live build preview"
                          sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                        />
                      </div>
                    ) : activeArtifact ? (
                      /* Render computed artifacts (PRD specification, tasks checklist, product thinking notes) */
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-[var(--border-subtle)]">
                          <span className="font-mono text-[11px] font-semibold text-[var(--text-secondary)]">
                            {activeStageType}_artifact.md
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--text-tertiary)] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1.5 py-0.5">
                            {typeof activeArtifact.content === "string" ? "markdown" : "json"}
                          </span>
                        </div>
                        <pre className="font-mono text-[12px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap select-text">
                          {typeof activeArtifact.content === "string"
                            ? activeArtifact.content
                            : JSON.stringify(activeArtifact.content, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      /* If active stage has no final artifact written yet, show live logging console */
                      <div className="flex h-full items-center justify-center py-10">
                        <StageLogVisualizer activeStage={activeStageType} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

                </div>
              </div>
            ) : (
              /* Simple mode — friendly progress view */
              <SimpleProgressView
                activeStageIndex={activeStageIndex}
                totalStages={STAGE_ORDER.length}
                activeStageType={activeStageType}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
