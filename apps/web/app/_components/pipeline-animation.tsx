"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ *
 * CodeSetu — Pipeline Journey
 *
 * A hand-drawn pipeline where SetuBot's paper plane flies along a real
 * SVG path (measured with getPointAtLength, so the plane and every
 * station always line up). Each station lights up, draws its icon, and
 * stamps a check as the plane passes; the run ends with a launch.
 * ------------------------------------------------------------------ */

type StageId = "idea" | "document" | "tasks" | "code" | "review" | "deploy";

interface Stage {
  id: StageId;
  label: string;
  caption: string;
  base: string; // accent stroke / fill when active
  tint: string; // soft fill when active
}

const STAGES: Stage[] = [
  { id: "idea", label: "Idea", caption: "A spark in your mind", base: "#EAB308", tint: "#FEF08A" },
  { id: "document", label: "Document", caption: "Drafted into a PRD", base: "#3B82F6", tint: "#BFDBFE" },
  { id: "tasks", label: "Tasks", caption: "Split into todos", base: "#A855F7", tint: "#E9D5FF" },
  { id: "code", label: "Code", caption: "Built in a sandbox", base: "#10B981", tint: "#A7F3D0" },
  { id: "review", label: "Review", caption: "Checked & approved", base: "#EC4899", tint: "#FBCFE8" },
  { id: "deploy", label: "Deploy", caption: "Shipped to production", base: "#F97316", tint: "#FDBA74" },
];

const N = STAGES.length;

// Position each station at the centre of an equal arc-length segment.
const STATION_FRACTIONS = STAGES.map((_, i) => (i + 0.5) / N);

const EASE = [0.65, 0, 0.35, 1] as const;
const ICON_EASE = [0.22, 1, 0.36, 1] as const;
const INK = "#2D2D2D";

/* Catmull-Rom control points -> a smooth wavy "road" across the canvas. */
const ROAD_POINTS: [number, number][] = [
  [44, 214],
  [186, 150],
  [330, 216],
  [492, 150],
  [652, 216],
  [812, 150],
  [958, 196],
];

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const ROAD_D = smoothPath(ROAD_POINTS);

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ==================================================================
 * Stage icons — drawn around local origin (0,0), ~40px tall.
 * Each rests in a calm idle state and plays a micro-animation when
 * `active`. Hand-drawn: 2px ink strokes, paper fills, accent on activate.
 * ================================================================== */

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

function StageIcon({ stage, active }: { stage: Stage; active: boolean }) {
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

/* ==================================================================
 * Paper plane that rides the path.
 * ================================================================== */

function PaperPlane({ traveling }: { traveling: boolean }) {
  return (
    <g>
      {traveling && (
        <motion.path
          d="M-20,-3 Q-32,-5 -42,-2 M-20,4 Q-32,6 -42,3 M-16,-7 Q-28,-10 -36,-7 M-16,8 Q-28,11 -36,8"
          fill="none"
          stroke={INK}
          strokeWidth="1.1"
          strokeDasharray="3 3"
          strokeLinecap="round"
          opacity="0.5"
          animate={{ strokeDashoffset: [0, 12] }}
          transition={{ repeat: Infinity, duration: 0.4, ease: "linear" }}
        />
      )}
      <path d="M-13,-8 L18,0 L-13,8 L-6,0 Z" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M-6,0 L18,0 M-13,8 L-6,0" fill="none" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M-13,-8 L-6,0 L-13,8 Z" fill="rgba(45,45,45,0.07)" />
    </g>
  );
}

/* ==================================================================
 * Main component
 * ================================================================== */

export default function PipelineAnimation() {
  const reduced = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const [mounted, setMounted] = useState(false);
  const [len, setLen] = useState(0);
  const [stationPts, setStationPts] = useState<{ x: number; y: number }[]>([]);

  const [reached, setReached] = useState(-1);
  const [focus, setFocus] = useState(-1);
  const [celebrate, setCelebrate] = useState(false);

  const progress = useMotionValue(0); // 0..1 along the path
  // Token identifying the active loop; bumping it cancels any prior loop so
  // StrictMode double-mounts / remounts can never run two loops at once.
  const runId = useRef(0);

  // Measure the path once it's in the DOM so the plane + stations align exactly.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    setLen(total);
    setStationPts(
      STATION_FRACTIONS.map((f) => {
        const pt = path.getPointAtLength(f * total);
        return { x: pt.x, y: pt.y };
      })
    );
    setMounted(true);
  }, []);

  // Plane position derived from the real path geometry.
  const planePoint = useTransform(progress, (t) => {
    const path = pathRef.current;
    if (!path || !len) return { x: ROAD_POINTS[0]![0], y: ROAD_POINTS[0]![1], angle: 0 };
    const d = t * len;
    const here = path.getPointAtLength(d);
    const ahead = path.getPointAtLength(Math.min(len, d + 1.5));
    const behind = path.getPointAtLength(Math.max(0, d - 1.5));
    return {
      x: here.x,
      y: here.y,
      angle: (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI,
    };
  });
  const planeX = useTransform(planePoint, (p) => p.x);
  const planeY = useTransform(planePoint, (p) => p.y);
  const planeAngle = useTransform(planePoint, (p) => p.angle);
  // Visible while travelling; fades out as it flies off the end.
  const planeOpacity = useTransform(progress, [0, 0.004, 0.95, 1], [0, 1, 1, 0]);

  const runCycle = useCallback(async () => {
    const myId = ++runId.current;
    const alive = () => runId.current === myId;

    while (alive()) {
      setReached(-1);
      setFocus(-1);
      setCelebrate(false);
      progress.set(0);
      await wait(550);
      if (!alive()) return;

      for (let i = 0; i < N; i++) {
        setFocus(i);
        await animate(progress, STATION_FRACTIONS[i]!, {
          duration: i === 0 ? 0.85 : 1.0,
          ease: EASE,
        }).finished;
        if (!alive()) return;
        setReached(i);
        if (i === N - 1) setCelebrate(true);
        await wait(950);
        if (!alive()) return;
      }

      setFocus(-1);
      await animate(progress, 1, { duration: 0.7, ease: "easeIn" }).finished;
      if (!alive()) return;
      await wait(1500);
      setCelebrate(false);
      await wait(450);
    }
  }, [progress]);

  useEffect(() => {
    if (!mounted) return;

    if (reduced) {
      // Reduced motion: show the completed, fully-lit pipeline, no looping.
      setReached(N - 1);
      setFocus(-1);
      progress.set(1);
      return;
    }

    runCycle();
    return () => {
      // Invalidate the active loop so it stops on unmount / remount.
      runId.current++;
    };
  }, [mounted, reduced, runCycle, progress]);

  return (
    <div
      className="w-full select-none"
      role="img"
      aria-label="Animation of a paper plane carrying an idea through the CodeSetu pipeline: idea, document, tasks, code, review, and deploy."
    >
      <svg viewBox="0 0 1000 380" className="w-full max-w-5xl mx-auto overflow-visible">
        <defs>
          <linearGradient id="road-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            {STAGES.map((s, i) => (
              <stop key={s.id} offset={`${(i / (N - 1)) * 100}%`} stopColor={s.base} />
            ))}
          </linearGradient>
        </defs>

        {/* faint cross-hatch backdrop */}
        <g opacity="0.05" stroke={INK} strokeWidth="1" fill="none">
          {Array.from({ length: 22 }).map((_, idx) => {
            const o = (idx - 11) * 60;
            return <line key={idx} x1={-120 + o} y1="-40" x2={380 + o} y2="440" />;
          })}
        </g>

        {/* the road: a sketchy ink base + the colour that fills as the plane advances */}
        <path ref={pathRef} d={ROAD_D} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" opacity="0.16" />
        <path
          d={ROAD_D}
          fill="none"
          stroke={INK}
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="1 11"
          opacity="0.3"
        />
        {mounted && (
          <motion.path
            d={ROAD_D}
            fill="none"
            stroke="url(#road-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            style={{ pathLength: progress }}
            opacity="0.85"
          />
        )}

        {/* stations */}
        {mounted &&
          stationPts.map((pt, i) => {
            const stage = STAGES[i]!;
            const isReached = i <= reached;
            const isFocus = i === focus;
            const lift = isFocus ? -9 : isReached ? -3 : 0;
            const scale = isFocus ? 1.07 : 1;
            const rot = i % 2 === 0 ? 1.4 : -1.4;

            return (
              <motion.g
                key={stage.id}
                style={{ originX: `${pt.x}px`, originY: `${pt.y}px` }}
                animate={{ y: lift, scale }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <g transform={`translate(${pt.x} ${pt.y})`}>
                  {/* soft ground shadow */}
                  <ellipse cx="0" cy="40" rx="30" ry="6" fill="rgba(45,45,45,0.10)" />

                  {/* paper tile */}
                  <g transform={`rotate(${rot})`}>
                    <rect
                      x="-33"
                      y="-31"
                      width="66"
                      height="62"
                      rx="11"
                      fill="#FFFFFF"
                      stroke={INK}
                      strokeWidth="2.2"
                      style={{
                        filter: isReached
                          ? `drop-shadow(2px 4px 0px ${stage.base}66)`
                          : "drop-shadow(2px 3px 0px rgba(45,45,45,0.12))",
                        transition: "filter 0.4s ease",
                      }}
                    />
                    {/* tinted wash when reached */}
                    <motion.rect
                      x="-33"
                      y="-31"
                      width="66"
                      height="62"
                      rx="11"
                      fill={stage.tint}
                      initial={false}
                      animate={{ opacity: isReached ? 0.5 : 0 }}
                      transition={{ duration: 0.4 }}
                    />
                    {/* pulsing focus ring */}
                    {isFocus && (
                      <motion.rect
                        x="-33"
                        y="-31"
                        width="66"
                        height="62"
                        rx="11"
                        fill="none"
                        stroke={stage.base}
                        strokeWidth="2"
                        initial={{ scale: 0.94, opacity: 0.8 }}
                        animate={{ scale: 1.18, opacity: 0 }}
                        transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
                        style={{ transformOrigin: "0px 0px" }}
                      />
                    )}
                  </g>

                  {/* icon */}
                  <g
                    style={{
                      opacity: isReached ? 1 : 0.4,
                      filter: isReached ? "none" : "grayscale(85%)",
                      transition: "opacity 0.4s ease, filter 0.4s ease",
                    }}
                  >
                    <StageIcon stage={stage} active={isReached} />
                  </g>

                  {/* completed check badge */}
                  <motion.g
                    initial={false}
                    animate={{
                      scale: isReached && !isFocus ? 1 : 0,
                      opacity: isReached && !isFocus ? 1 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 320, damping: 15 }}
                    style={{ transformOrigin: "26px -26px" }}
                  >
                    <circle cx="26" cy="-26" r="9" fill={stage.base} stroke={INK} strokeWidth="1.8" />
                    <path
                      d="M22,-26 l2.6,2.6 l5.2,-5.6"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.g>

                  {/* label */}
                  <text
                    x="0"
                    y="52"
                    textAnchor="middle"
                    fontSize="15"
                    fontWeight="bold"
                    fill={INK}
                    fontFamily="var(--font-patrick-hand), cursive, sans-serif"
                    opacity={isReached ? 1 : 0.55}
                    style={{ transition: "opacity 0.4s ease" }}
                  >
                    {stage.label}
                  </text>
                </g>

                {/* caption tooltip while focused */}
                <AnimatePresence>
                  {isFocus && (
                    <motion.g
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      transform={`translate(${pt.x} ${pt.y - 50})`}
                    >
                      <rect
                        x="-66"
                        y="-21"
                        width="132"
                        height="28"
                        rx="8"
                        fill="#FFFFFF"
                        stroke={INK}
                        strokeWidth="1.8"
                        style={{ filter: "drop-shadow(2px 3px 0px rgba(45,45,45,0.15))" }}
                      />
                      <path d="M-6,6 L0,13 L6,6 Z" fill="#FFFFFF" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                      <rect x="-6" y="5" width="12" height="3" fill="#FFFFFF" />
                      <text
                        x="0"
                        y="-2"
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="bold"
                        fill={INK}
                        fontFamily="var(--font-patrick-hand), cursive, sans-serif"
                      >
                        {stage.caption}
                      </text>
                    </motion.g>
                  )}
                </AnimatePresence>
              </motion.g>
            );
          })}

        {/* the travelling paper plane */}
        {mounted && (
          <motion.g style={{ x: planeX, y: planeY, opacity: planeOpacity }}>
            <motion.g style={{ rotate: planeAngle }}>
              <motion.g
                animate={focus >= 0 ? { y: [-1.5, 1.5, -1.5], rotate: [-2.5, 2.5, -2.5] } : {}}
                transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }}
              >
                <PaperPlane traveling={focus >= 0} />
              </motion.g>
            </motion.g>
          </motion.g>
        )}

        {/* launch confetti at the deploy station */}
        {mounted && celebrate && stationPts[N - 1] && <Confetti x={stationPts[N - 1]!.x} y={stationPts[N - 1]!.y} />}
      </svg>
    </div>
  );
}

function Confetti({ x, y }: { x: number; y: number }) {
  const colors = STAGES.map((s) => s.base);
  return (
    <g>
      {Array.from({ length: 20 }).map((_, i) => {
        const a = (i / 20) * Math.PI * 2;
        const dist = 50 + Math.random() * 55;
        return (
          <motion.path
            key={i}
            d="M-4,0 L4,0 M0,-4 L0,4"
            stroke={colors[i % colors.length]}
            strokeWidth="2.4"
            strokeLinecap="round"
            initial={{ x, y, opacity: 1, scale: 0.5 }}
            animate={{
              x: x + Math.cos(a) * dist,
              y: y + Math.sin(a) * dist - 10,
              opacity: 0,
              scale: 1.3,
              rotate: Math.random() * 180,
            }}
            transition={{ duration: 1.5, delay: i * 0.02, ease: "easeOut" }}
          />
        );
      })}
    </g>
  );
}
