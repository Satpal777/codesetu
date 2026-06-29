"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "../../_lib/auth-client";
import AgentWorkspace from "./_components/agent-workspace";
import ThemeToggle from "../../_components/theme-toggle";
import DeleteProjectModal from "../_components/delete-project-modal";
import {
  getProject,
  type Project,
} from "../_lib/projects";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ?? null;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleProjectDeleted = () => {
    if (projectId) {
      queryClient.removeQueries({ queryKey: ["project", projectId] });
      queryClient.setQueryData<Project[]>(["projects"], (prev) =>
        prev?.filter((p) => p.id !== projectId) ?? []
      );
    }
    router.push("/dashboard");
  };

  useEffect(() => {
    void params.then((p) => setProjectId(p.id));
  }, [params]);

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

  if (loadingUser && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ink-200)] border-t-[var(--ink-950)]" />
      </div>
    );
  }

  if (!loadingUser && !user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-[14px] text-[var(--text-secondary)]">Please sign in to view this project.</p>
      </div>
    );
  }

  if (!loadingUser && user && isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ink-200)] border-t-[var(--ink-950)]" />
      </div>
    );
  }

  if (!loadingUser && user && !isLoading && (isError || !project)) {
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

  if (!project) return null;

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
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            title="Delete project"
            className="flex items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] hover:border-red-400 hover:text-red-600 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            Delete
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Agent workspace — always shown immediately */}
      <div className="flex-1 px-6 py-5">
        <AgentWorkspace
          projectId={project.id}
          projectTitle={project.title}
          shareToken={project.shareToken}
          initialPrompt={project.prompt}
        />
      </div>

      {showDeleteModal && (
        <DeleteProjectModal
          project={project}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleProjectDeleted}
        />
      )}
    </div>
  );
}
