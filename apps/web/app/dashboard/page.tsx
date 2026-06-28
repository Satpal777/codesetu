"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../_lib/auth-client";
import { listProjects, relativeTime, type Project } from "./_lib/projects";
import NewProjectBox from "./_components/new-project-box";
import ThemeSwitch from "../_components/theme-switch";

const SUGGESTIONS = [
  "Landing page for my SaaS",
  "Internal admin dashboard",
  "Marketing site + blog",
  "REST API + dashboard",
  "App onboarding flow",
];

const TEMPLATES: { icon: string; title: string; prompt: string }[] = [
  {
    icon: "🛍️",
    title: "Product landing page",
    prompt: "A modern landing page for my SaaS product with a hero section, features grid, pricing table, and email signup form.",
  },
  {
    icon: "📋",
    title: "Admin dashboard",
    prompt: "An internal admin dashboard with a sidebar navigation, summary stat cards, a data table with search and filter, and a simple chart.",
  },
  {
    icon: "📝",
    title: "Blog / marketing site",
    prompt: "A clean marketing site with a blog. Include a hero, feature sections, a blog index page, and individual article layout.",
  },
  {
    icon: "⚡",
    title: "Waitlist page",
    prompt: "A high-converting waitlist page with a bold headline, short value proposition, email capture form, and social proof counter.",
  },
  {
    icon: "🧾",
    title: "Invoice tool",
    prompt: "A simple invoice generator tool where I can fill in client name, line items with quantities and prices, and print or download as PDF.",
  },
  {
    icon: "📊",
    title: "Portfolio site",
    prompt: "A personal portfolio site for a designer or developer. Include an about section, project cards with thumbnails, skills list, and contact form.",
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
        <ThemeSwitch />
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
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-3">
            Start from a template
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => handleTemplateClick(t.prompt)}
                className="press group flex items-center gap-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--fill-muted)]"
              >
                <span className="text-[18px] leading-none">{t.icon}</span>
                <span className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{t.title}</span>
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
                  <Link
                    key={p.id}
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
            </div>
            
            {/* Headers */}
            <div className="grid grid-cols-[2fr_100px_120px_100px_1.5fr] gap-3 px-2.5 pb-2 border-b-2 border-[var(--border-strong)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              <span>Project</span>
              <span>Status</span>
              <span>Stage</span>
              <span>Updated</span>
              <span>URL</span>
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
                    className="grid grid-cols-[2fr_100px_120px_100px_1.5fr] gap-3 px-2.5 py-3 items-center text-[13px] hover:bg-[var(--fill-muted)] transition-colors"
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
