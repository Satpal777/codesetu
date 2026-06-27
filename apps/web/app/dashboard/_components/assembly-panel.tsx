"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { LayoutSection, LayoutSpec, Stage } from "../_lib/projects";

const EASE = [0.175, 0.885, 0.32, 1.1] as const;
const BUILD_TYPES = ["tasks", "implementation", "review", "fixes"];

const SECTION_HEIGHT: Record<string, number> = {
  navbar: 52,
  hero: 200,
  form: 150,
  features: 190,
  gallery: 180,
  list: 170,
  cta: 150,
  content: 140,
  footer: 64,
};

const SECTION_LABEL: Record<string, string> = {
  navbar: "Navigation",
  hero: "Hero",
  form: "Form",
  features: "Features",
  gallery: "Gallery",
  list: "List",
  cta: "Call to action",
  content: "Content",
  footer: "Footer",
};

/* ----------------------------- Built pieces ----------------------------- */

function Btn({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-[var(--gray-1000)] px-3 text-[12px] font-medium text-[var(--background-100)]">
      {children}
    </span>
  );
}

function Line({ w }: { w: string }) {
  return <div className="h-2 rounded-full bg-[var(--gray-200)]" style={{ width: w }} />;
}

function pick(items: string[] | null | undefined, fallback: string[]): string[] {
  return items && items.length > 0 ? items : fallback;
}

function BuiltSection({ section }: { section: LayoutSection }) {
  const { title, subtitle, items, cta } = section;
  switch (section.type) {
    case "navbar":
      return (
        <div className="flex h-[52px] items-center justify-between border-b border-[var(--gray-alpha-200)] px-5">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-[var(--gray-1000)]" />
            <div className="h-2.5 w-16 rounded-full bg-[var(--gray-300)]" />
          </div>
          <div className="flex items-center gap-4">
            {pick(items, ["Home", "About"]).slice(0, 3).map((it, i) => (
              <span key={i} className="text-[11px] text-[var(--gray-700)]">{it}</span>
            ))}
            {cta && <Btn>{cta}</Btn>}
          </div>
        </div>
      );
    case "hero":
      return (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <h3 className="max-w-md text-[22px] font-semibold leading-tight tracking-tight text-[var(--gray-1000)]">
            {title ?? "Welcome"}
          </h3>
          {subtitle && <p className="max-w-sm text-[13px] leading-relaxed text-[var(--gray-700)]">{subtitle}</p>}
          {cta && <Btn>{cta}</Btn>}
        </div>
      );
    case "form":
      return (
        <div className="flex flex-col items-center gap-3 border-y border-[var(--gray-alpha-200)] bg-[var(--background-200)] px-6 py-10 text-center">
          {title && <p className="text-[15px] font-semibold text-[var(--gray-1000)]">{title}</p>}
          <div className="flex w-full max-w-sm items-center gap-2">
            <div className="h-9 flex-1 rounded-md border border-[var(--gray-alpha-300)] bg-[var(--background-100)]" />
            <Btn>{cta ?? "Submit"}</Btn>
          </div>
        </div>
      );
    case "features":
      return (
        <div className="px-6 py-10">
          {title && <p className="mb-5 text-center text-[15px] font-semibold text-[var(--gray-1000)]">{title}</p>}
          <div className="grid grid-cols-3 gap-3">
            {pick(items, ["Fast", "Simple", "Reliable"]).slice(0, 3).map((it, i) => (
              <div key={i} className="rounded-lg border border-[var(--gray-alpha-200)] p-3">
                <div className="mb-2 h-6 w-6 rounded-md bg-[var(--blue-700)]" />
                <p className="text-[12px] font-medium text-[var(--gray-1000)]">{it}</p>
                <div className="mt-2 space-y-1"><Line w="100%" /><Line w="70%" /></div>
              </div>
            ))}
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className="px-6 py-10">
          {title && <p className="mb-5 text-center text-[15px] font-semibold text-[var(--gray-1000)]">{title}</p>}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-lg bg-gradient-to-br from-[var(--gray-200)] to-[var(--gray-300)]" />
            ))}
          </div>
        </div>
      );
    case "list":
      return (
        <div className="px-6 py-8">
          {title && <p className="mb-4 text-[15px] font-semibold text-[var(--gray-1000)]">{title}</p>}
          <div className="space-y-2">
            {pick(items, ["Item one", "Item two", "Item three"]).slice(0, 4).map((it, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--gray-alpha-200)] p-3">
                <div className="h-7 w-7 shrink-0 rounded-md bg-[var(--gray-200)]" />
                <span className="text-[13px] text-[var(--gray-1000)]">{it}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "cta":
      return (
        <div
          className="flex flex-col items-center gap-3 border-y border-[var(--gray-alpha-200)] px-6 py-10 text-center"
          style={{ backgroundColor: "color-mix(in srgb, var(--blue-700) 7%, var(--background-100))" }}
        >
          <p className="text-[17px] font-semibold text-[var(--gray-1000)]">{title ?? "Ready to start?"}</p>
          {cta && <Btn>{cta}</Btn>}
        </div>
      );
    case "footer":
      return (
        <div className="flex items-center gap-5 border-t border-[var(--gray-alpha-200)] bg-[var(--background-200)] px-6 py-5">
          {pick(items, ["About", "Contact", "Privacy"]).slice(0, 4).map((it, i) => (
            <span key={i} className="text-[11px] text-[var(--gray-700)]">{it}</span>
          ))}
        </div>
      );
    default:
      return (
        <div className="px-6 py-8">
          {title && <p className="mb-3 text-[15px] font-semibold text-[var(--gray-1000)]">{title}</p>}
          <div className="space-y-2"><Line w="100%" /><Line w="92%" /><Line w="60%" /></div>
        </div>
      );
  }
}

function SkeletonSection({ type }: { type: string }) {
  const h = SECTION_HEIGHT[type] ?? 140;
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 border-b border-[var(--gray-alpha-100)]"
      style={{ height: h }}
    >
      <div className="h-2 w-24 animate-pulse rounded-full bg-[var(--gray-200)]" />
      <div className="h-2 w-40 animate-pulse rounded-full bg-[var(--gray-200)]" />
      <span className="mt-1 text-[10px] uppercase tracking-wide text-[var(--gray-500)]">
        {SECTION_LABEL[type] ?? "Section"}
      </span>
    </div>
  );
}

function Section({ section, built }: { section: LayoutSection; built: boolean }) {
  if (!built) return <SkeletonSection type={section.type} />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <BuiltSection section={section} />
    </motion.div>
  );
}

/* ----------------------------- The panel ----------------------------- */

interface Props {
  spec: LayoutSpec;
  stages: Stage[];
  projectStatus: string;
}

export default function AssemblyPanel({ spec, stages, projectStatus }: Props) {
  const sections = spec.sections ?? [];
  const N = sections.length;

  const build = stages.filter((s) => BUILD_TYPES.includes(s.type));
  const anyStarted = build.some((s) => s.status !== "pending");
  const allBuilt = N > 0 && build.length > 0 && build.every((s) => s.status === "completed");
  const pastBuild = stages.some((s) => (s.type === "approval" || s.type === "release") && s.status !== "pending");
  const done = projectStatus === "completed" || allBuilt || pastBuild;

  const [built, setBuilt] = useState(done ? N : 0);

  useEffect(() => {
    if (done) {
      setBuilt(N);
      return;
    }
    if (!anyStarted) {
      setBuilt(0);
      return;
    }
    // Build is active: reveal sections one at a time.
    setBuilt((b) => Math.max(b, 1));
    const id = setInterval(() => {
      setBuilt((b) => {
        if (b >= N) {
          clearInterval(id);
          return N;
        }
        return b + 1;
      });
    }, 950);
    return () => clearInterval(id);
  }, [done, anyStarted, N]);

  const placed = Math.min(built, N);
  const caption = done
    ? "All pieces in place"
    : anyStarted
      ? `Placing pieces… ${placed} of ${N}`
      : "Ready to build";

  return (
    <div className="rounded-2xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[var(--gray-1000)]">Building “{spec.screen}”</p>
          <p className="text-[11px] text-[var(--gray-600)]">{caption}</p>
        </div>
        {!done && anyStarted && (
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--blue-700)]" />
        )}
      </div>

      {/* Browser-chrome frame around the live mockup. */}
      <div className="overflow-hidden rounded-xl border border-[var(--gray-alpha-200)] bg-white">
        <div className="flex h-8 items-center gap-1.5 border-b border-[var(--gray-alpha-200)] bg-[var(--background-200)] px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
        </div>
        <div className="bg-white">
          {sections.map((s, i) => (
            <Section key={i} section={s} built={i < built} />
          ))}
        </div>
      </div>
    </div>
  );
}
