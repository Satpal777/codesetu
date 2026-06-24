"use client";

import { motion } from "motion/react";

/* ------------------------------------------------------------------ *
 * Shared pipeline-stage data + hand-drawn animated icons.
 *
 * Each icon is drawn around its local origin (0,0), ~40px tall, rests
 * in a calm idle state, and plays a micro-animation when `active`.
 * Consumed by both the hero pipeline animation and the stage showcase
 * grid so the two views stay perfectly in sync.
 * ------------------------------------------------------------------ */

export type StageId = "idea" | "document" | "tasks" | "code" | "review" | "deploy";

export interface Stage {
  id: StageId;
  label: string;
  caption: string;
  base: string; // accent stroke / fill when active
  tint: string; // soft fill when active
}

export const STAGES: Stage[] = [
  { id: "idea", label: "Idea", caption: "A spark in your mind", base: "#EAB308", tint: "#FEF08A" },
  { id: "document", label: "Document", caption: "Drafted into a PRD", base: "#3B82F6", tint: "#BFDBFE" },
  { id: "tasks", label: "Tasks", caption: "Split into todos", base: "#A855F7", tint: "#E9D5FF" },
  { id: "code", label: "Code", caption: "Built in a sandbox", base: "#10B981", tint: "#A7F3D0" },
  { id: "review", label: "Review", caption: "Checked & approved", base: "#EC4899", tint: "#FBCFE8" },
  { id: "deploy", label: "Deploy", caption: "Shipped to production", base: "#F97316", tint: "#FDBA74" },
];

export const INK = "#2D2D2D";
export const ICON_EASE = [0.22, 1, 0.36, 1] as const;

function IconIdea({ active, base, tint }: { active: boolean; base: string; tint: string }) {
  return (
    <g>
      {/* thinker's head */}
      <circle cx="0" cy="11" r="8" fill="#FFFFFF" stroke={INK} strokeWidth="2.1" />
      <circle cx="-2.6" cy="10.5" r="1" fill={INK} />
      <circle cx="2.6" cy="10.5" r="1" fill={INK} />
      <path d="M-2.4,13.6 Q0,15.4 2.4,13.6" fill="none" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />

      {/* idea bulb above the head */}
      <g transform="translate(0,-9)">
        {active && (
          <motion.circle
            cx="0"
            cy="-1"
            r="12"
            fill={tint}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.55, 0.4], scale: [0.7, 1.1, 1] }}
            transition={{ duration: 1, ease: ICON_EASE }}
            style={{ filter: "blur(5px)", transformOrigin: "0px -1px" }}
          />
        )}
        {[-58, -29, 0, 29, 58].map((deg, i) => {
          const r = (deg * Math.PI) / 180;
          return (
            <motion.line
              key={deg}
              x1={Math.sin(r) * 8}
              y1={-8 - Math.cos(r) * 8}
              x2={Math.sin(r) * 12}
              y2={-8 - Math.cos(r) * 12}
              stroke={base}
              strokeWidth="1.8"
              strokeLinecap="round"
              initial={false}
              animate={{ opacity: active ? [0, 1, 0.85] : 0, pathLength: active ? 1 : 0 }}
              transition={{ duration: 0.5, delay: active ? 0.2 + i * 0.04 : 0, ease: ICON_EASE }}
            />
          );
        })}
        <motion.path
          d="M-5.5,-1 a5.5,5.5 0 1,1 11,0 c0,2.6 -1.7,4 -2.5,5.4 h-6 c-0.8,-1.4 -2.5,-2.8 -2.5,-5.4 Z"
          fill={active ? tint : "#FFFFFF"}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
          animate={{ fill: active ? tint : "#FFFFFF" }}
          transition={{ duration: 0.4 }}
        />
        <path
          d="M-2.4,-0.5 q2.4,3 4.8,0"
          fill="none"
          stroke={INK}
          strokeWidth="1.6"
          strokeLinecap="round"
          style={{ filter: active ? `drop-shadow(0 0 3px ${base})` : "none" }}
        />
        <path d="M-2.4,5 h4.8 M-1.6,7 h3.2" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function IconDocument({ active, base }: { active: boolean; base: string }) {
  const lines = [-4, 2, 8];
  return (
    <g>
      <path
        d="M-12,-16 H6 L13,-9 V16 a2,2 0 0 1 -2,2 H-12 a2,2 0 0 1 -2,-2 V-14 a2,2 0 0 1 2,-2 Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M6,-16 V-9 H13" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <motion.rect
        x="-8"
        y="-10"
        height="3.4"
        rx="1.7"
        fill={base}
        initial={false}
        animate={{ width: active ? 14 : 10, opacity: active ? 1 : 0.5 }}
        transition={{ duration: 0.4, ease: ICON_EASE }}
      />
      {lines.map((y, i) => (
        <motion.rect
          key={y}
          x="-8"
          y={y}
          height="2.8"
          rx="1.4"
          fill="rgba(45,45,45,0.5)"
          initial={false}
          animate={{ width: active ? (i === lines.length - 1 ? 10 : 18) : 0, opacity: active ? 1 : 0 }}
          transition={{ duration: 0.4, delay: active ? 0.18 + i * 0.13 : 0, ease: ICON_EASE }}
        />
      ))}
    </g>
  );
}

function IconTasks({ active, base }: { active: boolean; base: string }) {
  const rows = [0, 1, 2];
  return (
    <g>
      <rect x="-12" y="-15" width="24" height="32" rx="4" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
      <rect
        x="-5"
        y="-18.5"
        width="10"
        height="5.5"
        rx="2"
        fill={active ? base : "#FFFFFF"}
        stroke={INK}
        strokeWidth="1.8"
      />
      {rows.map((i) => {
        const y = -8 + i * 9;
        return (
          <g key={i}>
            <motion.rect
              x="-8"
              y={y - 3.5}
              width="7"
              height="7"
              rx="2"
              fill="#FFFFFF"
              stroke={INK}
              strokeWidth="1.6"
              animate={{ stroke: active ? base : INK }}
              transition={{ delay: active ? i * 0.2 : 0 }}
            />
            <motion.path
              d={`M-6.5 ${y} l1.6 1.6 l3 -3.6`}
              fill="none"
              stroke={base}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
              transition={{ duration: 0.28, delay: active ? 0.18 + i * 0.2 : 0, ease: ICON_EASE }}
            />
            <motion.rect
              x="3"
              y={y - 1.6}
              height="3.2"
              rx="1.6"
              fill="rgba(45,45,45,0.42)"
              initial={false}
              animate={{ width: active ? 7 : 5, opacity: active ? 0.6 : 0.3 }}
              transition={{ delay: active ? i * 0.2 : 0 }}
            />
          </g>
        );
      })}
    </g>
  );
}

function IconCode({ active, base }: { active: boolean; base: string }) {
  return (
    <g>
      <rect x="-15" y="-13" width="30" height="26" rx="4" fill="#FFFFFF" stroke={INK} strokeWidth="2" />
      <line x1="-15" y1="-6.5" x2="15" y2="-6.5" stroke="rgba(45,45,45,0.25)" strokeWidth="1.4" />
      <circle cx="-11" cy="-9.8" r="1.3" fill="#EF4444" />
      <circle cx="-7" cy="-9.8" r="1.3" fill="#F59E0B" />
      <circle cx="-3" cy="-9.8" r="1.3" fill="#22C55E" />
      <motion.path
        d="M-5,-1 l-4,3.8 l4,3.8"
        fill="none"
        stroke={base}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: active ? 1 : 0.35, opacity: active ? 1 : 0.45 }}
        transition={{ duration: 0.45, delay: active ? 0.1 : 0, ease: ICON_EASE }}
      />
      <motion.path
        d="M5,-1 l4,3.8 l-4,3.8"
        fill="none"
        stroke={base}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: active ? 1 : 0.35, opacity: active ? 1 : 0.45 }}
        transition={{ duration: 0.45, delay: active ? 0.18 : 0, ease: ICON_EASE }}
      />
      <motion.line
        x1="1.5"
        y1="-2.4"
        x2="-1.5"
        y2="6.4"
        stroke={INK}
        strokeWidth="2.1"
        strokeLinecap="round"
        initial={false}
        animate={{ opacity: active ? 1 : 0.45 }}
        transition={{ duration: 0.3, delay: active ? 0.26 : 0 }}
      />
    </g>
  );
}

function IconReview({ active, base }: { active: boolean; base: string }) {
  return (
    <g>
      {/* diff sheet behind the lens */}
      <rect x="-13" y="-15" width="20" height="28" rx="3" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" />
      <rect x="-10" y="-10" width="4" height="2.6" rx="1" fill="#22C55E" />
      <rect x="-4.5" y="-10" width="9" height="2.6" rx="1.3" fill="rgba(45,45,45,0.28)" />
      <rect x="-10" y="-5" width="4" height="2.6" rx="1" fill="#EF4444" />
      <rect x="-4.5" y="-5" width="7" height="2.6" rx="1.3" fill="rgba(45,45,45,0.28)" />
      <rect x="-10" y="0" width="4" height="2.6" rx="1" fill="#22C55E" />
      <rect x="-4.5" y="0" width="8" height="2.6" rx="1.3" fill="rgba(45,45,45,0.28)" />

      {/* magnifier */}
      <circle cx="5" cy="3" r="9" fill="rgba(255,255,255,0.65)" stroke={INK} strokeWidth="2.1" />
      <line x1="11.5" y1="9.5" x2="17" y2="15" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <motion.path
        d="M0.5,3 l3,3.2 l5.5,-6.4"
        fill="none"
        stroke={base}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
        transition={{ duration: 0.4, delay: active ? 0.25 : 0, ease: ICON_EASE }}
        style={{ filter: active ? `drop-shadow(0 0 2px ${base})` : "none" }}
      />
    </g>
  );
}

function IconDeploy({ active, base, tint }: { active: boolean; base: string; tint: string }) {
  return (
    <g>
      <motion.ellipse
        cx="0"
        cy="17"
        rx="13"
        ry="3.4"
        fill={base}
        animate={{ opacity: active ? 0.4 : 0.12 }}
        transition={{ duration: 0.4 }}
        style={{ filter: "blur(3px)" }}
      />
      <motion.g
        initial={false}
        animate={{ y: active ? [-0.5, 1.5, -6, -2.5] : 0 }}
        transition={{ duration: 1.3, ease: ICON_EASE, times: [0, 0.18, 0.7, 1] }}
      >
        {/* flame */}
        <motion.path
          d="M-4,8 Q0,22 4,8 Z"
          fill={base}
          animate={{ scaleY: active ? [0.3, 1.2, 0.85, 1.1] : 0, opacity: active ? 1 : 0 }}
          transition={{
            scaleY: { duration: 0.16, repeat: Infinity },
            opacity: { duration: 0.25, delay: active ? 0.15 : 0 },
          }}
          style={{ transformOrigin: "0px 8px", filter: "blur(0.3px)" }}
        />
        {/* body */}
        <path
          d="M0,-18 c6,4.5 8.5,12 8.5,19.5 0,6 -2.2,10.5 -2.2,10.5 H-6.3 s-2.2,-4.5 -2.2,-10.5 C-10.5,-6 -6,-13.5 0,-18 Z"
          fill={active ? tint : "#FFFFFF"}
          stroke={INK}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="-3" r="3.6" fill="#FFFFFF" stroke={base} strokeWidth="2" />
        <path d="M-8,3 l-5,7 5,-1.4 Z" fill={base} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8,3 l5,7 -5,-1.4 Z" fill={base} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      </motion.g>
    </g>
  );
}

export function StageIcon({ stage, active }: { stage: Stage; active: boolean }) {
  const p = { active, base: stage.base, tint: stage.tint };
  switch (stage.id) {
    case "idea":
      return <IconIdea {...p} />;
    case "document":
      return <IconDocument {...p} />;
    case "tasks":
      return <IconTasks {...p} />;
    case "code":
      return <IconCode {...p} />;
    case "review":
      return <IconReview {...p} />;
    case "deploy":
      return <IconDeploy {...p} />;
  }
}
