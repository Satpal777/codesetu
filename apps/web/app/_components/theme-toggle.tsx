"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "codesetu-theme";
const EASE = [0.2, 0, 0, 1] as const;

function readTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function SunIcon() {
  return (
    <motion.svg
      key="sun"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.6, rotate: -45 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.6, rotate: 45 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <path
        d="M12 2.6v2.4M12 19v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.6 12h2.4M19 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

function MoonIcon() {
  return (
    <motion.svg
      key="moon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
      transition={{ duration: 0.18, ease: EASE }}
    >
      <path d="M18.8 15.1A7.4 7.4 0 0 1 8.9 5.2 7.9 7.9 0 1 0 18.8 15.1Z" fill="currentColor" />
    </motion.svg>
  );
}

/**
 * ThemeToggle — a shadcn-style switch (track + sliding thumb) that flips the
 * app theme via `:root[data-theme]`. The thumb slides with a spring and the
 * sun/moon glyph crossfades; a faint hint icon sits on the opposite side of the
 * track. Honors prefers-reduced-motion.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();
  const isDark = theme === "dark";

  useEffect(() => {
    const next = readTheme();
    document.documentElement.dataset.theme = next;
    setTheme(next);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = isDark ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore storage failures */
    }
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={toggle}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.12, ease: EASE }}
      className={`relative inline-flex h-7 w-[52px] shrink-0 cursor-pointer items-center rounded-full border border-[var(--ink-200)] px-[3px] transition-colors duration-200 ${className}`}
      style={{
        backgroundColor: isDark ? "var(--ink-800)" : "var(--ink-100)",
        opacity: mounted ? 1 : 0,
      }}
    >
      <span className="sr-only">{isDark ? "Dark mode" : "Light mode"}</span>

      {/* faint hint glyphs in the track */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-[8px] top-1/2 -translate-y-1/2 text-[var(--ink-400)]"
        style={{ opacity: isDark ? 0.55 : 0 }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <path
            d="M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 text-[var(--ink-400)]"
        style={{ opacity: isDark ? 0 : 0.55 }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M18.8 15.1A7.4 7.4 0 0 1 8.9 5.2 7.9 7.9 0 1 0 18.8 15.1Z" fill="currentColor" />
        </svg>
      </span>

      {/* sliding thumb */}
      <motion.span
        className="relative z-10 grid h-[22px] w-[22px] place-items-center rounded-full bg-[var(--white)] text-[var(--ink-700)] ring-1 ring-[var(--ink-200)]"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.18), 0 1px 1px rgba(0,0,0,0.06)" }}
        animate={{ transform: isDark ? "translateX(24px)" : "translateX(0px)" }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
      >
        <AnimatePresence initial={false} mode="wait">
          {isDark ? <MoonIcon /> : <SunIcon />}
        </AnimatePresence>
      </motion.span>
    </motion.button>
  );
}
