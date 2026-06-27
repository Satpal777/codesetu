"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ *
 * Feature Cards (Geist)
 *
 * The "how it's kept safe & durable" details as four minimal cards:
 * a monochrome stroke icon, a title, a one-line description, and a
 * monospace tech tag. Restrained color, subtle borders, lots of air.
 * ------------------------------------------------------------------ */

const EASE = [0.175, 0.885, 0.32, 1.1] as const;
const STROKE = "var(--gray-1000)";

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.6 L20 5.5 V11.5 C20 16.5 16.4 19.6 12 21 C7.6 19.6 4 16.5 4 11.5 V5.5 Z"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12 l2.4 2.4 l4.6 -5"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SandboxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10.5" rx="1.8" fill="none" stroke={STROKE} strokeWidth="1.6" />
      <path d="M8.5 10 V8 a3.5 3.5 0 0 1 7 0 V10" fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.3" fill={STROKE} />
    </svg>
  );
}

function PipelineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12 a9 9 0 1 1 3 6.7" fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 12 H7 M3 12 V8" fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7 V17" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 9 C7 13 16 11 16 14" fill="none" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="5.5" r="2.2" fill="none" stroke={STROKE} strokeWidth="1.6" />
      <circle cx="7" cy="18.5" r="2.2" fill="none" stroke={STROKE} strokeWidth="1.6" />
      <circle cx="16" cy="16" r="2.2" fill="none" stroke={STROKE} strokeWidth="1.6" />
    </svg>
  );
}

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  tag: string;
}

const FEATURES: Feature[] = [
  {
    icon: <ShieldIcon />,
    title: "Row-Level Security",
    description: "Per-tenant Postgres policies keep every workspace's data fully isolated.",
    tag: "Postgres RLS",
  },
  {
    icon: <SandboxIcon />,
    title: "Sealed Sandboxes",
    description: "Generated code runs in ephemeral, isolated containers — never on your host.",
    tag: "E2B",
  },
  {
    icon: <PipelineIcon />,
    title: "Durable Pipelines",
    description: "Every step is retryable and resumable, so a long run never loses progress.",
    tag: "Inngest",
  },
  {
    icon: <GitIcon />,
    title: "Auto Commit & CI",
    description: "Changes commit, open a pull request, and ship through a scoped GitHub App.",
    tag: "GitHub App",
  },
];

export default function FeatureChips() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature, i) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
          className="geist-card flex flex-col p-5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--gray-alpha-300)] bg-[var(--background-100)]">
            {feature.icon}
          </span>
          <h3 className="mt-5 text-[15px] font-semibold tracking-tight text-[var(--gray-1000)]">{feature.title}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--gray-900)]">{feature.description}</p>
          <span className="mt-4 inline-flex w-fit items-center rounded-md bg-[var(--gray-100)] px-2 py-0.5 font-mono text-xs text-[var(--gray-900)]">
            {feature.tag}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
