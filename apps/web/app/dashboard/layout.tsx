"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "../_lib/auth-client";
import { listProjects, relativeTime } from "./_lib/projects";

// Map backend stages to clean label
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ?? null;

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => listProjects(signal),
    enabled: !!user,
  });

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      // Signed-out users belong on the marketing landing page, not a bare dashboard.
      router.replace("/");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const isInitialLoad = loadingUser && !user;

  // Active path helpers
  const isDash = pathname === "/dashboard";

  // Get top 4 recent projects for the sidebar
  const recentMini = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 4);

  if (isInitialLoad) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ink-200)] border-t-[var(--ink-950)]" />
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="cs-landing flex h-screen w-screen overflow-hidden bg-[var(--bg-base)]">
      {/* ══ SIDEBAR ══ */}
      <aside className="flex h-full w-[236px] min-w-[236px] flex-shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-raised)]">
        {/* Logo */}
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-[18px] py-4">
          <span className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[3px] bg-[var(--ink-950)] text-[var(--white)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M3 16 Q12 4 21 16" />
              <line x1="3" y1="16" x2="3" y2="20" />
              <line x1="21" y1="16" x2="21" y2="20" />
              <line x1="12" y1="9" x2="12" y2="20" />
            </svg>
          </span>
          <span className="flex-1 text-[14px] font-bold tracking-tight text-[var(--text-primary)]">CodeSetu</span>
          <span className="rounded-[2px] bg-[var(--bg-inset)] px-1.5 py-[2px] font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Pro</span>
        </div>

        {/* Nav */}
        <nav className="flex-shrink-0 space-y-1 p-2">
          <Link
            href="/dashboard"
            className={`flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2.5 text-left text-[13px] transition-colors ${
              isDash
                ? "bg-[var(--fill-muted)] font-semibold text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--fill-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9,22 9,12 15,12 15,22" />
            </svg>
            Dashboard
          </Link>
          <Link
            href="/dashboard"
            className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2.5 text-left text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-muted)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="flex-shrink-0">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            New build
          </Link>
        </nav>

        <div className="mx-2 h-[1px] bg-[var(--border-subtle)]" />

        {/* Recent mini */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          <div className="px-2 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
            Recent
          </div>
          {projectsLoading ? (
            <div className="space-y-2 p-2">
              <div className="h-3.5 w-full animate-pulse rounded bg-[var(--bg-inset)]" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bg-inset)]" />
            </div>
          ) : recentMini.length === 0 ? (
            <p className="px-2 py-1 text-[11px] text-[var(--text-tertiary)]">No recent builds</p>
          ) : (
            <div className="space-y-0.5">
              {recentMini.map((p) => {
                const stageLabel = STAGE_LABELS[p.currentStage] || p.currentStage;
                return (
                  <Link
                    key={p.id}
                    href={`/dashboard/${p.id}`}
                    className={`block w-full rounded-[4px] px-2 py-2 text-left transition-colors hover:bg-[var(--fill-muted)] ${
                      pathname === `/dashboard/${p.id}` ? "bg-[var(--fill-muted)]" : ""
                    }`}
                  >
                    <div className="truncate text-[12px] font-semibold leading-tight text-[var(--text-primary)]">
                      {p.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                      {stageLabel} · {relativeTime(p.updatedAt)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="flex flex-shrink-0 items-center gap-2.5 border-t border-[var(--border-subtle)] px-3 py-3.5">
          <img
            src={user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
            alt=""
            className="h-[30px] w-[30px] rounded-full border border-[var(--border-default)] object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="flex-1 min-w-0">
            <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{user.name}</div>
            <div className="font-mono text-[9px] uppercase tracking-wide text-[var(--text-tertiary)]">Pro plan</div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="rounded-[4px] p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--fill-muted)] hover:text-[var(--text-primary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ══ MAIN CONTENT AREA ══ */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
