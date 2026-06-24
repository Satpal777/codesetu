"use client";

import Link from "next/link";
import {
  STAGES,
  STAGE_COUNT,
  relativeTime,
  stageIndex,
  stageLabel,
  type Project,
  type ProjectStatus,
} from "../_lib/projects";

const STATUS: Record<ProjectStatus, { label: string; dot: string; text: string }> = {
  running: { label: "Running", dot: "var(--blue-700)", text: "var(--blue-700)" },
  awaiting_input: { label: "Needs you", dot: "var(--amber-700)", text: "var(--amber-700)" },
  completed: { label: "Completed", dot: "var(--green-800)", text: "var(--green-800)" },
  failed: { label: "Failed", dot: "var(--red-900)", text: "var(--red-900)" },
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--gray-alpha-300)] bg-[var(--background-100)] px-2.5 py-1 text-[12px] font-medium"
      style={{ color: s.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {s.label}
    </span>
  );
}

/** Nine slim segments that fill up as the pipeline advances. */
function StageProgress({ status, currentStage }: Pick<Project, "status" | "currentStage">) {
  const currentIdx = stageIndex(currentStage);
  const done = status === "completed";
  const reached = done ? STAGE_COUNT : currentIdx + 1;
  const active = STATUS[status].dot;

  return (
    <div>
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          let color = "var(--gray-200)"; // future
          if (done || i < currentIdx) color = "var(--gray-1000)"; // completed
          else if (i === currentIdx) color = active; // in progress
          return (
            <span
              key={stage.type}
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: color }}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-[var(--gray-700)]">
        {done ? "Released" : stageLabel(currentStage)}
        <span className="text-[var(--gray-500)]"> · {reached}/{STAGE_COUNT}</span>
      </p>
    </div>
  );
}

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/dashboard/${project.id}`}
      className="geist-card group flex flex-col p-5 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--gray-1000)]">
          {project.title || "Untitled project"}
        </h3>
        <StatusBadge status={project.status} />
      </div>

      <p className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-[var(--gray-700)]">
        {project.prompt}
      </p>

      <div className="mt-5">
        <StageProgress status={project.status} currentStage={project.currentStage} />
      </div>

      <p className="mt-4 text-[12px] text-[var(--gray-600)]">Updated {relativeTime(project.updatedAt)}</p>
    </Link>
  );
}
