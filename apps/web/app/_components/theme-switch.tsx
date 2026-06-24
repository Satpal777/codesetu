"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "codesetu-theme";

function readTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function SunIcon() {
  return (
    <motion.svg
      key="sun"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.84, rotate: -24 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.84, rotate: 24 }}
      transition={{ duration: 0.16, ease: [0.175, 0.885, 0.32, 1.1] }}
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        d="M12 2.8v2.3M12 18.9v2.3M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M2.8 12h2.3M18.9 12h2.3M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}

function MoonIcon() {
  return (
    <motion.svg
      key="moon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      initial={{ opacity: 0, scale: 0.84, rotate: -18 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, scale: 0.84, rotate: 18 }}
      transition={{ duration: 0.16, ease: [0.175, 0.885, 0.32, 1.1] }}
    >
      <path
        d="M18.8 15.1A7.4 7.4 0 0 1 8.9 5.2 7.9 7.9 0 1 0 18.8 15.1Z"
        fill="currentColor"
      />
    </motion.svg>
  );
}

export default function ThemeSwitch({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const isDark = theme === "dark";

  useEffect(() => {
    const nextTheme = readTheme();
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={toggleTheme}
      className={`theme-switch ${className}`}
      data-state={isDark ? "dark" : "light"}
      initial={false}
      animate={{ opacity: mounted ? 1 : 0 }}
      whileTap={reduceMotion ? undefined : { transform: "scale(0.97)" }}
      transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.175, 0.885, 0.32, 1.1] }}
    >
      <span className="sr-only">{isDark ? "Dark mode" : "Light mode"}</span>
      <span className="theme-switch__track" aria-hidden="true">
        <span className="theme-switch__glyph theme-switch__glyph--sun">
          <SunIcon />
        </span>
        <span className="theme-switch__glyph theme-switch__glyph--moon">
          <MoonIcon />
        </span>
        <motion.span
          className="theme-switch__thumb"
          animate={{
            transform: isDark ? "translateX(32px) rotate(180deg)" : "translateX(0px) rotate(0deg)",
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", duration: 0.38, bounce: 0.18 }
          }
        >
          <AnimatePresence initial={false} mode="wait">
            {isDark ? <MoonIcon /> : <SunIcon />}
          </AnimatePresence>
        </motion.span>
      </span>
    </motion.button>
  );
}
