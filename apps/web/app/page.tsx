"use client";

import { motion } from "motion/react";
import PipelineAnimation from "./_components/pipeline-animation";
import StageShowcase from "./_components/stage-showcase";
import FeatureChips from "./_components/feature-chips";
import ThemeSwitch from "./_components/theme-switch";
import { UserResponse } from "@repo/schemas";
import { authClient } from "./_lib/auth-client";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

// System easing from design.md, used for the short, physical reveals.
const EASE = [0.175, 0.885, 0.32, 1.1] as const;

// Reusable scroll-reveal: short, subtle, honors reduced motion via Motion.
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.5, delay, ease: EASE },
});

function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 w-6 text-xs" : "h-7 w-7 text-sm";
  const text = size === "sm" ? "text-sm" : "text-[15px]";
  return (
    <span className="flex items-center gap-2">
      <span className={`flex ${box} items-center justify-center rounded-md bg-[var(--gray-1000)] font-semibold text-[var(--background-100)]`}>
        C
      </span>
      <span className={`${text} font-semibold tracking-tight text-[var(--gray-1000)]`}>CodeSetu</span>
    </span>
  );
}

export default function Home() {
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ? (session.user as unknown as UserResponse) : null;

  // Simple, direct Google sign-in — no modal, no scroll.
  const handleGoogleLogin = async () => {
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: FRONTEND_URL });
    } catch (err) {
      console.error("Google sign-in failed:", err);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background-100)] text-[var(--gray-1000)]">
      {/* NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-[var(--gray-alpha-400)] bg-[var(--header-background)] backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#top" aria-label="CodeSetu home">
            <Wordmark />
          </a>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#how" className="text-sm text-[var(--gray-900)] transition-colors hover:text-[var(--gray-1000)]">
              How it works
            </a>
            <a href="#steps" className="text-sm text-[var(--gray-900)] transition-colors hover:text-[var(--gray-1000)]">
              Pipeline
            </a>
            <a href="#features" className="text-sm text-[var(--gray-900)] transition-colors hover:text-[var(--gray-1000)]">
              Features
            </a>
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitch className="mr-1" />
            {loadingUser ? (
              <div className="h-8 w-20 animate-pulse rounded-md bg-[var(--gray-100)]" />
            ) : user ? (
              <>
                <span className="flex items-center gap-2 pr-1">
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
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button onClick={handleGoogleLogin} className="geist-btn geist-btn-ghost">
                  Sign In
                </button>
                <button onClick={handleGoogleLogin} className="geist-btn geist-btn-primary">
                  Get Started
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      <main id="top" className="flex-1">
        {/* HERO */}
        <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-24 text-center md:pb-32 md:pt-36">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--gray-alpha-300)] bg-[var(--background-100)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--gray-900)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--blue-700)]" />
            Powered by AI
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: EASE }}
            className="mt-8 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--gray-1000)] sm:text-6xl md:text-7xl"
          >
            From idea to shipped product, entirely automated
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--gray-900)] md:text-xl"
          >
            Describe what you want in plain words. CodeSetu plans, builds, reviews, and ships it — end to end.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.19, ease: EASE }}
            className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row"
          >
            <button
              onClick={handleGoogleLogin}
              className="geist-btn geist-btn-lg geist-btn-primary w-full sm:w-auto"
            >
              Get Started
            </button>
            <a href="#how" className="geist-btn geist-btn-lg geist-btn-secondary w-full sm:w-auto">
              See how it works
            </a>
          </motion.div>

          <p className="mt-5 text-[13px] text-[var(--gray-700)]">No setup required · Sign in with Google</p>
        </section>

        {/* IDEA → PRODUCTION ANIMATION (kept as the centerpiece) */}
        <section id="how" className="border-t border-[var(--gray-alpha-400)] bg-[var(--background-200)]">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <motion.div {...reveal()} className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--gray-700)]">How it works</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-[var(--gray-1000)] md:text-4xl">
                From idea to production
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--gray-900)]">
                Watch a single spark travel through every stage of the pipeline — documented, built, reviewed, and deployed.
              </p>
            </motion.div>

            <motion.div
              {...reveal(0.1)}
              className="mt-14 overflow-hidden rounded-2xl border border-[var(--gray-alpha-300)] bg-[var(--background-100)] p-4 md:p-8"
            >
              <PipelineAnimation />
            </motion.div>
          </div>
        </section>

        {/* SIX STEPS */}
        <section id="steps" className="mx-auto max-w-6xl px-6 py-24 md:py-32">
          <motion.div {...reveal()} className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--gray-700)]">Pipeline</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-[var(--gray-1000)] md:text-4xl">
              Six steps, one flow
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[var(--gray-900)]">
              Every idea moves through the same calm, repeatable path — no handoffs, no surprises.
            </p>
          </motion.div>

          <div className="mt-14">
            <StageShowcase />
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="border-t border-[var(--gray-alpha-400)] bg-[var(--background-200)]">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <motion.div {...reveal()} className="mx-auto max-w-2xl text-center">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--gray-700)]">Under the hood</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.02em] text-[var(--gray-1000)] md:text-4xl">
                Safe and durable by default
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-[var(--gray-900)]">
                Production-grade guardrails are built into every pipeline, not bolted on afterward.
              </p>
            </motion.div>

            <div className="mt-14">
              <FeatureChips />
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-[var(--gray-alpha-400)]">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center md:py-32">
            <motion.h2
              {...reveal()}
              className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-[var(--gray-1000)] md:text-5xl"
            >
              Ready to ship your next idea?
            </motion.h2>
            <motion.p {...reveal(0.08)} className="mt-5 max-w-md text-lg leading-relaxed text-[var(--gray-900)]">
              Start with a single sentence. Watch it become a deployed product.
            </motion.p>
            <motion.button
              {...reveal(0.15)}
              onClick={handleGoogleLogin}
              className="geist-btn geist-btn-lg geist-btn-primary mt-9"
            >
              Get Started
            </motion.button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[var(--gray-alpha-400)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <Wordmark size="sm" />
          <p className="text-[13px] text-[var(--gray-700)]">
            © {new Date().getFullYear()} CodeSetu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
