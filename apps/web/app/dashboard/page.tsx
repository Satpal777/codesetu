"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { UserResponse } from "@repo/schemas";
import { authClient } from "../_lib/auth-client";
import ThemeSwitch from "../_components/theme-switch";
import { listProjects, type Project } from "./_lib/projects";
import NewProjectBox from "./_components/new-project-box";
import ProjectCard from "./_components/project-card";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
const EASE = [0.175, 0.885, 0.32, 1.1] as const;

type LoadState = "loading" | "ready" | "error";

function Brand() {
  return (
    <Link href="/" aria-label="CodeSetu home" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--gray-1000)] text-sm font-semibold text-[var(--background-100)]">
        C
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-[var(--gray-1000)]">CodeSetu</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ? (session.user as unknown as UserResponse) : null;

  const [projects, setProjects] = useState<Project[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setState("loading");
    setError(null);
    try {
      const data = await listProjects(signal);
      if (signal?.aborted) return;
      setProjects(data);
      setState("ready");
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [user, load]);

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: `${FRONTEND_URL}/dashboard` });
    } catch (err) {
      console.error("Google sign-in failed:", err);
    }
  };

  // Only show the full-screen spinner on the very first load before any user data arrives.
  // Once we have (or have confirmed the absence of) a user, keep that UI stable so
  // ThemeSwitch is never unmounted by a background session refetch.
  const isInitialLoad = loadingUser && !user;

  return (
    <div className={`flex min-h-screen flex-col ${user ? "bg-[var(--background-200)]" : "bg-[var(--background-100)]"} text-[var(--gray-1000)]`}>

      {/* ─── Persistent header — ThemeSwitch lives here and never remounts ─── */}
      <header className="sticky top-0 z-40 border-b border-[var(--gray-alpha-400)] bg-[var(--header-background)] backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Brand />
          <div className="flex items-center gap-3">
            <ThemeSwitch />

            {/* Skeleton while the very first session fetch is in flight */}
            {isInitialLoad && (
              <div className="h-8 w-20 animate-pulse rounded-md bg-[var(--gray-100)]" />
            )}

            {/* Authenticated nav items */}
            {!isInitialLoad && user && (
              <>
                <span className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt=""
                    className="h-7 w-7 rounded-full border border-[var(--gray-alpha-400)] object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="hidden text-sm font-medium text-[var(--gray-1000)] sm:inline">
                    {user.name.split(" ")[0]}
                  </span>
                </span>
                <button onClick={handleSignOut} className="geist-btn geist-btn-secondary">
                  Sign out
                </button>
              </>
            )}

            {/* Sign-in button for unauthenticated visitors */}
            {!isInitialLoad && !user && (
              <button onClick={handleGoogleLogin} className="geist-btn geist-btn-primary">
                Continue with Google
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* ─── Page content ─── */}

      {/* Initial loading spinner */}
      {isInitialLoad && (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--gray-200)] border-t-[var(--gray-1000)]" />
        </div>
      )}

      {/* Not signed in */}
      {!isInitialLoad && !user && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <Brand />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--gray-1000)]">
              Sign in to open your dashboard
            </h1>
            <p className="mt-2 text-[15px] text-[var(--gray-700)]">Your projects live here once you're in.</p>
          </div>
          <button onClick={handleGoogleLogin} className="geist-btn geist-btn-lg geist-btn-primary">
            Continue with Google
          </button>
        </div>
      )}

      {/* Dashboard */}
      {!isInitialLoad && user && (
        <main className="relative mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
          {/* Premium backdrop behind the hero — glow + fading dot grid. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px] overflow-hidden">
            <div className="hero-glow absolute inset-0" />
            <div className="dot-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--gray-1000)] md:text-3xl">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-2 text-[15px] text-[var(--gray-700)]">
              Describe an idea. Watch it become a real, working app.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06, ease: EASE }}
            className="mt-8"
          >
            <NewProjectBox onCreated={(project) => setProjects((prev) => [project, ...prev])} />
          </motion.div>

          <section className="mt-14">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--gray-1000)]">Your projects</h2>
              {state === "ready" && projects.length > 0 && (
                <span className="text-[13px] text-[var(--gray-600)]">{projects.length} total</span>
              )}
            </div>

            <div className="mt-5">
              {state === "loading" && <ProjectsSkeleton />}

              {state === "error" && (
                <div className="rounded-2xl border border-[var(--gray-alpha-300)] bg-[var(--background-100)] px-6 py-12 text-center">
                  <p className="text-[15px] font-medium text-[var(--gray-1000)]">Couldn't load your projects</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-[var(--gray-700)]">{error}</p>
                  <button onClick={() => load()} className="geist-btn geist-btn-secondary mt-5">
                    Try again
                  </button>
                </div>
              )}

              {state === "ready" && projects.length === 0 && <EmptyState />}

              {state === "ready" && projects.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project, i) => (
                    <ProjectCard key={project.id} project={project} index={i} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--gray-alpha-300)] bg-[var(--background-100)] p-5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--gray-100)]" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-[var(--gray-100)]" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[var(--gray-100)]" />
          <div className="mt-6 h-1.5 w-full animate-pulse rounded-full bg-[var(--gray-100)]" />
          <div className="mt-4 h-3 w-24 animate-pulse rounded bg-[var(--gray-100)]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--gray-alpha-400)] bg-[var(--background-100)] px-6 py-16 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gray-alpha-300)] bg-[var(--background-200)]">
        <span className="text-lg">✦</span>
      </div>
      <p className="mt-4 text-[15px] font-medium text-[var(--gray-1000)]">No projects yet</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-[var(--gray-700)]">
        Describe an idea in the box above and CodeSetu turns it into a real, working app.
      </p>
    </div>
  );
}
