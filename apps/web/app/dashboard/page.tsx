"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../_lib/auth-client";
import { listProjects, relativeTime, type Project } from "./_lib/projects";
import NewProjectBox from "./_components/new-project-box";
import ThemeToggle from "../_components/theme-toggle";
import DeleteProjectModal from "./_components/delete-project-modal";
import DeleteAllProjectsModal from "./_components/delete-all-projects-modal";

const SUGGESTIONS = [
  "Landing page for my SaaS",
  "Internal admin dashboard",
  "Marketing site + blog",
  "REST API + dashboard",
  "App onboarding flow",
];

const TEMPLATES: { title: string; prompt: string }[] = [
  {
    title: "Landing page",
    prompt: "Build a modern product landing page with a bold hero section, feature highlights grid, social proof, pricing table, and email signup CTA.",
  },
  {
    title: "Admin dashboard",
    prompt: "Build an internal admin dashboard with a sidebar navigation, key metric stat cards, a searchable and filterable data table, and a simple bar chart.",
  },
  {
    title: "Marketing + blog",
    prompt: "Build a marketing site with a homepage, feature sections, a blog index listing recent posts with thumbnails, and a single article page template.",
  },
  {
    title: "Waitlist page",
    prompt: "Build a high-converting waitlist page with a compelling headline, brief value proposition, an email capture form with validation, and a live signup counter.",
  },
  {
    title: "Invoice tool",
    prompt: "Build a browser-based invoice generator where I can add client info and line items with quantities and unit prices, auto-calculate totals, and print or download as PDF.",
  },
  {
    title: "Portfolio site",
    prompt: "Build a personal portfolio site with an about section, project showcase cards with tags, a skills list, and a contact form at the bottom.",
  },
];

const STAGE_ORDER = [
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

const STAGE_LABELS: Record<string, string> = {
  request: "Idea",
  product_thinking: "Thinking",
  prd: "Spec",
  design: "Design",
  tasks: "To-dos",
  implementation: "Code",
  review: "Review",
  fixes: "Polishing",
  approval: "Approval",
  release: "Live",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Building",
  awaiting_input: "Needs you",
  completed: "Live",
  failed: "Failed",
};

export default function DashboardPage() {
  const { data: session } = authClient.useSession();
  const user = session?.user ?? null;
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const composerRef = useRef<HTMLDivElement>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const handleProjectDeleted = (id: string) => {
    queryClient.setQueryData<Project[]>(["projects"], (prev) => prev?.filter((p) => p.id !== id) ?? []);
    setDeletingProject(null);
  };

  const handleAllProjectsDeleted = () => {
    queryClient.setQueryData<Project[]>(["projects"], []);
    setShowDeleteAllModal(false);
  };

  const handleTemplateClick = (templatePrompt: string) => {
    setPrompt(templatePrompt);
    setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => listProjects(signal),
    enabled: !!user,
  });

  const handleProjectCreated = (project: Project) => {
    queryClient.setQueryData<Project[]>(["projects"], (prev) => [project, ...(prev ?? [])]);
  };

  // Time-based greeting helper
  const hr = new Date().getHours();
  const period = hr < 12 ? "morning" : hr < 17 ? "afternoon" : "evening";
  const greeting = user ? `Good ${period}, ${user.name.split(" ")[0]}.` : `Good ${period}.`;

  // Sort and split projects
  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const recentProjects = sortedProjects.slice(0, 4);

  return (
    <div className="relative flex flex-col min-h-full bg-[var(--bg-base)]">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      {/* Main Composer Area */}
      <div className="mx-auto w-full max-w-[700px] px-6 py-14">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)] mb-2">
          {period}
        </div>
        <h1 className="cs-display text-[36px] tracking-tight leading-none mb-9 text-[var(--text-primary)]">
          {greeting}
        </h1>

        {/* Template Gallery */}
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-2">
            Start from a template
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => handleTemplateClick(t.prompt)}
                className="press cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-1 font-mono text-[11px] tracking-wide text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap gap-2 mb-3.5">
          {SUGGESTIONS.map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => setPrompt(sug)}
              className="press cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-1 font-mono text-[11px] tracking-wide text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Composer Box */}
        <div ref={composerRef}>
          <NewProjectBox onCreated={handleProjectCreated} prompt={prompt} setPrompt={setPrompt} />
        </div>
      </div>

      {/* Projects List & History */}
      <div className="mx-auto w-full max-w-[1040px] px-6 pb-20">
        
        {/* Recent Grid */}
        <div className="mb-11">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Recent projects</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">
              {projects.length} total
            </span>
          </div>

          {projectsLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="h-28 w-full animate-pulse rounded border border-[var(--border-default)] bg-[var(--bg-raised)]" />
              <div className="h-28 w-full animate-pulse rounded border border-[var(--border-default)] bg-[var(--bg-raised)]" />
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="rounded border border-dashed border-[var(--border-default)] bg-[var(--bg-raised)] px-6 py-10 text-center">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">No projects yet</p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Describe your idea above to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recentProjects.map((p) => {
                const progress = p.status === "completed" ? 100 : Math.max(10, Math.round(((STAGE_ORDER.indexOf(p.currentStage) + 1) / STAGE_ORDER.length) * 100));
                const stageLabel = STAGE_LABELS[p.currentStage] || p.currentStage;
                const statusLabel = STATUS_LABELS[p.status] || p.status;

                return (
                  <div key={p.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setDeletingProject(p)}
                      title="Delete project"
                      className="absolute top-2 right-2 z-10 hidden group-hover:flex h-6 w-6 items-center justify-center rounded border border-[var(--border-default)] bg-[var(--bg-raised)] text-[var(--text-tertiary)] hover:border-red-400 hover:text-red-600 transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  <Link
                    href={`/dashboard/${p.id}`}
                    className="press block w-full rounded border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left shadow-sm hover:border-[var(--border-strong)]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span className="text-[13px] font-semibold leading-snug text-[var(--text-primary)] truncate max-w-[200px]">
                        {p.title}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] border border-[var(--border-default)] rounded px-1.5 py-[2px] bg-[var(--bg-inset)]">
                        {statusLabel}
                      </span>
                    </div>

                    <div className="h-[3px] w-full bg-[var(--bg-inset)] rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-[var(--ink-950)] rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] font-mono text-[var(--text-tertiary)]">
                      <span>
                        {stageLabel} · {STAGE_ORDER.indexOf(p.currentStage) + 1}/{STAGE_ORDER.length}
                      </span>
                      <span>{relativeTime(p.updatedAt)}</span>
                    </div>
                  </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History Table */}
        {sortedProjects.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">Project history</h2>
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(true)}
                className="flex items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] hover:border-red-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Delete all
              </button>
            </div>
            
            {/* Headers */}
            <div className="grid grid-cols-[2fr_100px_120px_100px_1.5fr_36px] gap-3 px-2.5 pb-2 border-b-2 border-[var(--border-strong)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              <span>Project</span>
              <span>Status</span>
              <span>Stage</span>
              <span>Updated</span>
              <span>URL</span>
              <span />
            </div>

            {/* Rows */}
            <div className="divide-y divide-[var(--border-subtle)]">
              {sortedProjects.map((p) => {
                const stageLabel = STAGE_LABELS[p.currentStage] || p.currentStage;
                const statusLabel = STATUS_LABELS[p.status] || p.status;
                const isLive = p.status === "completed" && p.deploymentUrl;

                return (
                  <div
                    key={p.id}
                    className="group grid grid-cols-[2fr_100px_120px_100px_1.5fr_36px] gap-3 px-2.5 py-3 items-center text-[13px] hover:bg-[var(--fill-muted)] transition-colors"
                  >
                    <Link
                      href={`/dashboard/${p.id}`}
                      className="font-medium text-[var(--text-primary)] truncate hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {statusLabel}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                      {stageLabel}
                    </span>
                    <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                      {new Date(p.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                    {isLive ? (
                      <a
                        href={p.deploymentUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline truncate"
                      >
                        {p.deploymentUrl?.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--text-disabled)]">—</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeletingProject(p)}
                      title="Delete project"
                      className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded border border-transparent text-[var(--text-disabled)] hover:border-red-400 hover:text-red-600 transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {deletingProject && (
        <DeleteProjectModal
          project={deletingProject}
          onClose={() => setDeletingProject(null)}
          onDeleted={() => handleProjectDeleted(deletingProject.id)}
        />
      )}

      {showDeleteAllModal && (
        <DeleteAllProjectsModal
          onClose={() => setShowDeleteAllModal(false)}
          onDeleted={handleAllProjectsDeleted}
        />
      )}
    </div>
  );
}
