"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import BridgeFlow from "./_components/bridge-flow";
import ThemeToggle from "./_components/theme-toggle";
import { UserResponse } from "@repo/schemas";
import { authClient } from "./_lib/auth-client";

const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";

// Design system easing (cubic-bezier(0.2, 0, 0, 1)) — calm, physical reveals.
const EASE = [0.2, 0, 0, 1] as const;

// Above-the-fold entrance (plays on mount).
const load = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
});

// Scroll reveal — short, once, honors reduced motion via Motion.
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.7, delay, ease: EASE },
});

/** The CodeSetu bridge glyph — an arch on two piers. */
function BridgeMark({ size = 18, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
      <path d="M3 16 Q12 4 21 16" />
      <line x1="3" y1="16" x2="3" y2="20" />
      <line x1="21" y1="16" x2="21" y2="20" />
      <line x1="12" y1="9" x2="12" y2="20" />
    </svg>
  );
}

type Feature = { title: string; desc: string; icon: React.ReactNode };

const FEATURES: Feature[] = [
  {
    title: "Prompt to plan",
    desc: "Type a thought. CodeSetu turns ambiguity into a structured, editable plan you can steer at every step.",
    icon: <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5 10.1 11.9 4.5 10l5.6-1.4L12 3Z" />,
  },
  {
    title: "Living documents",
    desc: "A spec that stays in sync with the build. Decisions are written down, not lost in a chat history.",
    icon: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </>
    ),
  },
  {
    title: "Ordered to-dos",
    desc: "Work broken into a dependency-aware checklist, so the build proceeds in the right order automatically.",
    icon: (
      <>
        <path d="M9 6h11" />
        <path d="M9 12h11" />
        <path d="M9 18h11" />
        <path d="m3 6 1 1 2-2" />
        <path d="m3 12 1 1 2-2" />
        <path d="m3 18 1 1 2-2" />
      </>
    ),
  },
  {
    title: "Real code, your stack",
    desc: "Production-grade code in the frameworks you already use — readable, owned by you, never a black box.",
    icon: (
      <>
        <path d="m8 8-4 4 4 4" />
        <path d="m16 8 4 4-4 4" />
        <path d="m13.5 5.5-3 13" />
      </>
    ),
  },
  {
    title: "Instant preview",
    desc: "See it running the moment it changes. React to something real instead of imagining the result.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="15" rx="2" />
        <path d="M3 9h18" />
        <circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" />
        <path d="M10 21h4" />
      </>
    ),
  },
  {
    title: "One-click deploy",
    desc: "Ship to a real URL with a single click. The last step of the bridge is already built for you.",
    icon: (
      <>
        <path d="M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2 0-3s-2.2-.8-3 0Z" />
        <path d="m12 15-3-3a12 12 0 0 1 7-8 6 6 0 0 1 4 4 12 12 0 0 1-8 7Z" />
        <circle cx="15" cy="9" r="1.5" />
      </>
    ),
  },
];

const FLOW_CAPTIONS = [
  {
    label: "Think & shape · 01–02",
    body: "Describe the idea in plain language. CodeSetu asks the right questions and iterates with you until the shape is clear.",
  },
  {
    label: "Capture & plan · 03–04",
    body: "It writes a living document and breaks the work into ordered to-dos — a plan you can actually trust and edit.",
  },
  {
    label: "Build & ship · 05–07",
    body: "Real code in your stack, a live preview to react to, and one-click deploy. Idea to production, end to end.",
  },
];

export default function Home() {
  const router = useRouter();
  const { data: session, isPending: loadingUser } = authClient.useSession();
  const user = session?.user ? (session.user as unknown as UserResponse) : null;

  // Logged-in users skip the marketing page and land straight on their dashboard.
  useEffect(() => {
    if (!loadingUser && user) {
      router.replace("/dashboard");
    }
  }, [loadingUser, user, router]);

  // Auth UX state — without this, a failed/slow sign-in looks like a dead button.
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Direct Google sign-in — no modal, no scroll. On success the client redirects
  // the browser to Google, so we intentionally stay in the pending state.
  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthPending(true);
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: FRONTEND_URL });
    } catch (err) {
      console.error("Google sign-in failed:", err);
      setAuthError("Couldn't reach the sign-in server. Make sure the backend is running, then try again.");
      setAuthPending(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
      setAuthError("Sign out failed. Please try again.");
    }
  };

  // Primary CTA: signed-in users cross into the app; everyone else signs in.
  const goPrimary = () => {
    if (authPending) return;
    if (user) window.location.href = "/dashboard";
    else handleGoogleLogin();
  };

  // A signed-in session is being redirected to /dashboard — show a spinner
  // instead of flashing the marketing page on the way out.
  if (!loadingUser && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ink-200)] border-t-[var(--ink-950)]" />
      </div>
    );
  }

  return (
    <div className="cs-landing flex min-h-screen flex-col overflow-x-hidden">
      {/* ===================== NAV ===================== */}
      <header
        id="cs-nav"
        className="sticky top-0 z-50 border-b border-[var(--ink-150)] backdrop-blur-md backdrop-saturate-150"
        style={{ background: "var(--cs-header-bg)" }}
      >
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 md:px-10">
          <a href="#top" aria-label="CodeSetu home" className="flex items-center gap-2.5 no-underline">
            <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[3px] bg-[var(--ink-950)] text-[var(--white)]">
              <BridgeMark />
            </span>
            <span className="text-[19px] font-bold tracking-[-0.02em] text-[var(--ink-950)]">CodeSetu</span>
          </a>

          <nav className="hidden items-center gap-9 md:flex">
            <a href="#flow" className="text-sm font-medium text-[var(--ink-700)] no-underline transition-opacity hover:opacity-60">
              The Flow
            </a>
            <a href="#features" className="text-sm font-medium text-[var(--ink-700)] no-underline transition-opacity hover:opacity-60">
              Features
            </a>
            <a href="#" className="text-sm font-medium text-[var(--ink-700)] no-underline transition-opacity hover:opacity-60">
              Docs
            </a>
          </nav>

          <div className="flex items-center gap-3.5">
            <ThemeToggle />
            {loadingUser ? (
              <div className="h-8 w-24 animate-pulse rounded bg-[var(--ink-100)]" />
            ) : user ? (
              <>
                <span className="flex items-center gap-2 pr-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                    alt=""
                    className="h-7 w-7 rounded-full border border-[var(--ink-200)] object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="hidden text-sm font-medium text-[var(--ink-950)] sm:inline">{user.name.split(" ")[0]}</span>
                </span>
                <button onClick={handleSignOut} className="cs-btn cs-btn-sm cs-btn-outline">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={authPending}
                  className="hidden text-sm font-medium text-[var(--ink-700)] transition-opacity hover:opacity-60 disabled:opacity-50 sm:inline"
                >
                  Sign in
                </button>
                <button onClick={goPrimary} disabled={authPending} className="cs-btn cs-btn-sm cs-btn-solid disabled:opacity-60">
                  {authPending ? "Connecting…" : "Start free"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* ===================== HERO ===================== */}
        <section className="mx-auto max-w-[1280px] px-6 md:px-10">
          <div className="grid items-center gap-14 py-14 sm:py-20 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[1.05fr_1fr] lg:gap-20 lg:py-16">
            {/* left copy */}
            <div>
              <motion.div {...load(0)} className="mb-7">
                <span className="cs-badge">
                  <span className="cs-badge-dot" />
                  Zero → Production
                </span>
              </motion.div>

              <motion.h1
                {...load(0.05)}
                className="cs-display mb-6 text-balance text-[clamp(44px,5vw,76px)] text-[var(--ink-950)]"
              >
                From a spark of an idea to shipped
              </motion.h1>

              <motion.p {...load(0.12)} className="mb-10 max-w-[480px] text-[18px] leading-[1.65] text-[var(--ink-600)]">
                CodeSetu is the bridge between thinking and shipping. Describe what you want; watch it become a plan, a
                document, real code, a live preview, and a deployment.
              </motion.p>

              <motion.div {...load(0.18)} className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                <button onClick={goPrimary} disabled={authPending} className="cs-btn cs-btn-lg cs-btn-solid disabled:opacity-60">
                  {authPending ? "Connecting…" : "Start building free"}
                </button>
                <a href="#flow" className="cs-btn cs-btn-lg cs-btn-outline">
                  See it in motion
                </a>
              </motion.div>

              <motion.div
                {...load(0.24)}
                className="cs-mono mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] uppercase tracking-[0.08em] text-[var(--ink-400)]"
              >
                <span>No setup</span>
                <span className="opacity-40">/</span>
                <span>Your stack</span>
                <span className="opacity-40">/</span>
                <span>Deploy in minutes</span>
              </motion.div>
            </div>

            {/* right bridge visual */}
            <motion.div {...load(0.1)} className="relative">
              <div
                className="relative rounded-[3px] border border-[var(--ink-200)] bg-[var(--white)] px-8 pb-7 pt-9"
                style={{ boxShadow: "8px 8px 0 0 var(--ink-950)" }}
              >
                <div className="cs-mono mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--ink-400)]">
                  <span className="h-[7px] w-[7px] rounded-full border border-[var(--ink-300)]" />
                  <span className="h-[7px] w-[7px] rounded-full border border-[var(--ink-300)]" />
                  <span className="h-[7px] w-[7px] rounded-full border border-[var(--ink-300)]" />
                  <span className="ml-auto">setu.bridge</span>
                </div>

                <svg viewBox="0 0 560 280" className="block h-auto w-full overflow-visible">
                  {/* ground baseline */}
                  <line x1="20" y1="222" x2="540" y2="222" stroke="var(--ink-200)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
                  {/* pillars */}
                  <line x1="70" y1="170" x2="70" y2="222" stroke="var(--ink-300)" strokeWidth="1.5" />
                  <line x1="490" y1="170" x2="490" y2="222" stroke="var(--ink-300)" strokeWidth="1.5" />
                  <line x1="280" y1="86" x2="280" y2="222" stroke="var(--ink-150)" strokeWidth="1.5" />
                  {/* suspension cables */}
                  <line x1="70" y1="170" x2="180" y2="135" stroke="var(--ink-150)" strokeWidth="1" />
                  <line x1="180" y1="135" x2="280" y2="118" stroke="var(--ink-150)" strokeWidth="1" />
                  <line x1="280" y1="118" x2="380" y2="135" stroke="var(--ink-150)" strokeWidth="1" />
                  <line x1="380" y1="135" x2="490" y2="170" stroke="var(--ink-150)" strokeWidth="1" />
                  {/* bridge deck */}
                  <path id="cs-bridge" d="M70 170 Q280 38 490 170" fill="none" stroke="var(--ink-950)" strokeWidth="2.5" strokeLinecap="round" />
                  {/* endpoints */}
                  <circle cx="70" cy="170" r="7" fill="var(--white)" stroke="var(--ink-950)" strokeWidth="2.5" />
                  <circle cx="490" cy="170" r="7" fill="var(--ink-950)" />
                  {/* traveling token */}
                  <g>
                    <circle r="9" fill="var(--ink-950)">
                      <animateMotion dur="3.6s" repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.2 1">
                        <mpath href="#cs-bridge" />
                      </animateMotion>
                    </circle>
                    <circle r="9" fill="none" stroke="var(--ink-950)" strokeWidth="1.5" opacity="0.5">
                      <animateMotion dur="3.6s" repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.2 1">
                        <mpath href="#cs-bridge" />
                      </animateMotion>
                      <animate attributeName="r" values="9;20;9" dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  </g>
                  <text x="70" y="252" textAnchor="middle" fontSize="12" letterSpacing="1.5" fill="var(--ink-500)" style={{ fontFamily: "var(--font-mono-cs)" }}>
                    IDEA
                  </text>
                  <text x="490" y="252" textAnchor="middle" fontSize="12" letterSpacing="1.5" fill="var(--ink-950)" style={{ fontFamily: "var(--font-mono-cs)" }}>
                    LIVE
                  </text>
                </svg>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===================== FLOW ===================== */}
        <section id="flow" className="border-y border-[var(--ink-150)] bg-[var(--white)]">
          <div className="mx-auto max-w-[1280px] px-6 py-28 md:px-10 md:py-40">
            <motion.div {...reveal()} className="mx-auto mb-20 max-w-[680px] text-center md:mb-24">
              <div className="cs-eyebrow mb-5">How the flow works</div>
              <h2 className="cs-display mb-[18px] text-[clamp(36px,4.5vw,60px)] text-[var(--ink-950)]">Watch an idea cross the bridge.</h2>
              <p className="text-[18px] leading-[1.6] text-[var(--ink-600)]">
                Every stage feeds the next. Nothing is thrown away — your thinking compounds into shipped software.
              </p>
            </motion.div>

            <motion.div {...reveal(0.1)}>
              <BridgeFlow />
            </motion.div>

            <motion.div {...reveal(0.2)} className="mt-20 grid gap-10 md:grid-cols-3">
              {/* SVG Gradient definitions for the lamp beams */}
              <svg className="absolute w-0 h-0" aria-hidden="true">
                <defs>
                  <linearGradient id="lamp-indigo-beam" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                    <stop offset="40%" stopColor="#6366f1" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="lamp-sky-beam" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {FLOW_CAPTIONS.map((c) => (
                <div 
                  key={c.label} 
                  className="relative border-t border-[var(--ink-100)] pt-[28px] pb-[16px] px-6 overflow-hidden group min-h-[190px] rounded-b-lg transition-all duration-500 hover:shadow-[0_10px_30px_rgba(99,102,241,0.04)]"
                >
                  {/* Lamp Highlight Effect (Continuous Volumetric Beams) */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
                    {/* Glowing top line (Base of the lamp) */}
                    <motion.div 
                      initial={{ width: "20%", opacity: 0 }}
                      whileInView={{ width: "100%", opacity: 1 }}
                      transition={{ duration: 1.2, ease: EASE }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-[0.5px] z-10"
                    />
                    <motion.div 
                      initial={{ width: "10%", opacity: 0 }}
                      whileInView={{ width: "80%", opacity: 0.8 }}
                      transition={{ duration: 1.4, ease: EASE }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-full bg-gradient-to-r from-transparent via-sky-300 to-transparent z-10"
                    />
                    
                    {/* Volumetric Beam 1 (Wide, soft Indigo) */}
                    <motion.svg 
                      initial={{ opacity: 0, scaleY: 0.3 }}
                      whileInView={{ opacity: 0.75, scaleY: 1 }}
                      whileHover={{ opacity: 0.95 }}
                      transition={{ duration: 1.2, ease: EASE }}
                      style={{ originY: 0 }}
                      className="absolute inset-x-0 top-0 w-full h-48 filter blur-xl" 
                      viewBox="0 0 400 200" 
                      preserveAspectRatio="none"
                    >
                      <polygon points="80,0 320,0 360,200 40,200" fill="url(#lamp-indigo-beam)" />
                    </motion.svg>

                    {/* Volumetric Beam 2 (Narrower, brighter Sky Blue) */}
                    <motion.svg 
                      initial={{ opacity: 0, scaleY: 0.3 }}
                      whileInView={{ opacity: 0.85, scaleY: 1 }}
                      whileHover={{ opacity: 1, scaleY: 1.05 }}
                      transition={{ duration: 1.4, ease: EASE }}
                      style={{ originY: 0 }}
                      className="absolute inset-x-0 top-0 w-full h-48 filter blur-md" 
                      viewBox="0 0 400 200" 
                      preserveAspectRatio="none"
                    >
                      <polygon points="150,0 250,0 280,200 120,200" fill="url(#lamp-sky-beam)" />
                    </motion.svg>

                    {/* Ambient Radial Glow centered under the line */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      whileInView={{ opacity: 0.6, scale: 1 }}
                      transition={{ duration: 1.2, ease: EASE }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.25),transparent_70%)] blur-md"
                    />
                    
                    {/* Central glowing core dot */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 0.8 }}
                      transition={{ duration: 1.5, ease: EASE }}
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-[5px] rounded-full bg-sky-200 blur-[2px]"
                    />

                    {/* Bottom fade overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--white)] to-transparent pointer-events-none" />
                  </div>

                  {/* Text contents (reacts with color transition on hover) */}
                  <div className="relative z-10 transition-colors duration-500">
                    <div className="cs-mono mb-2.5 text-[11px] uppercase tracking-[0.12em] text-[var(--ink-400)] transition-colors duration-500 group-hover:text-indigo-600 font-semibold">
                      {c.label}
                    </div>
                    <p className="text-[16px] leading-[1.55] text-[var(--ink-700)] transition-colors duration-500 group-hover:text-[var(--ink-950)]">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===================== FEATURES ===================== */}
        <section id="features" className="mx-auto max-w-[1280px] px-6 py-28 md:px-10 md:py-40">
          <motion.div {...reveal()} className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end md:gap-10">
            <div className="max-w-[620px]">
              <div className="cs-eyebrow mb-5">What&apos;s in the bridge</div>
              <h2 className="cs-display text-[clamp(36px,4.5vw,60px)] text-[var(--ink-950)]">Everything between idea and live.</h2>
            </div>
            <p className="max-w-[300px] text-[16px] leading-[1.6] text-[var(--ink-600)] md:mb-1.5">
              A small set of sharp tools, designed to hand off to each other cleanly.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} {...reveal((i % 3) * 0.05)} className="cs-feature">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[3px] bg-[var(--ink-950)] text-[var(--white)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {f.icon}
                  </svg>
                </span>
                <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--ink-950)]">{f.title}</h3>
                <p className="text-[15px] leading-[1.6] text-[var(--ink-600)]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===================== FINAL CTA ===================== */}
        <section data-theme="ink" className="bg-[var(--ink-950)]">
          <div className="mx-auto max-w-[1280px] px-6 py-28 text-center md:px-10 md:py-40">
            <motion.div {...reveal()} className="mb-8 inline-flex">
              <span className="inline-flex h-[54px] w-[54px] items-center justify-center rounded-[4px] bg-[var(--white)] text-[var(--ink-950)]">
                <BridgeMark size={30} />
              </span>
            </motion.div>
            <motion.h2
              {...reveal(0.05)}
              className="cs-display mx-auto mb-6 max-w-[820px] text-[clamp(40px,5.5vw,76px)] leading-[1.03] text-[var(--white)]"
            >
              Cross the bridge from idea to production.
            </motion.h2>
            <motion.p {...reveal(0.1)} className="mx-auto mb-11 max-w-[520px] text-[18px] leading-[1.6] text-[var(--ink-300)]">
              Start with a sentence. Ship something real today. CodeSetu carries it the whole way across.
            </motion.p>
            <motion.div {...reveal(0.16)} className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button onClick={goPrimary} disabled={authPending} className="cs-btn cs-btn-lg cs-btn-solid disabled:opacity-60">
                {authPending ? "Connecting…" : "Start building free"}
              </button>
              <a href="#flow" className="cs-btn cs-btn-lg cs-btn-outline">
                Talk to us
              </a>
            </motion.div>
          </div>

          {/* footer */}
          <div className="border-t border-[var(--ink-800)]">
            <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 px-6 py-9 md:px-10">
              <div className="flex items-center gap-2.5">
                <span className="text-[16px] font-bold tracking-[-0.02em] text-[var(--white)]">CodeSetu</span>
                <span className="cs-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ink-500)]">/ the bridge to production</span>
              </div>
              <div className="cs-mono flex items-center gap-7 text-[12px] uppercase tracking-[0.06em] text-[var(--ink-400)]">
                <a href="#" className="no-underline transition-opacity hover:opacity-60">Product</a>
                <a href="#" className="no-underline transition-opacity hover:opacity-60">Docs</a>
                <a href="#" className="no-underline transition-opacity hover:opacity-60">Pricing</a>
                <span className="text-[var(--ink-600)]">© {new Date().getFullYear()}</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Auth error toast — makes failures visible instead of silently failing. */}
      {authError && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          role="alert"
          className="fixed inset-x-0 bottom-6 z-[60] mx-auto flex max-w-[480px] items-start gap-3 rounded-[4px] border border-[var(--ink-300)] bg-[var(--white)] px-4 py-3 text-[14px] text-[var(--ink-900)] shadow-[6px_6px_0_0_var(--ink-950)]"
        >
          <span className="leading-[1.5]">{authError}</span>
          <button
            onClick={() => setAuthError(null)}
            aria-label="Dismiss"
            className="ml-auto shrink-0 text-[var(--ink-400)] transition-opacity hover:opacity-60"
          >
            ✕
          </button>
        </motion.div>
      )}
    </div>
  );
}
