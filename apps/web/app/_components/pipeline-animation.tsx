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
import { INK, STAGES, StageIcon } from "./stage-data";

/* ------------------------------------------------------------------ *
 * CodeSetu — Pipeline Journey
 *
 * A hand-drawn pipeline where SetuBot's paper plane flies along a real
 * SVG path (measured with getPointAtLength, so the plane and every
 * station always line up). Each station lights up, draws its icon, and
 * stamps a check as the plane passes; the run ends with a launch.
 *
 * Stage data and the per-stage animated icons live in ./stage-data so
 * the showcase grid below the fold renders the exact same artwork.
 * ------------------------------------------------------------------ */

const N = STAGES.length;

// Position each station at the centre of an equal arc-length segment.
const STATION_FRACTIONS = STAGES.map((_, i) => (i + 0.5) / N);

const EASE = [0.65, 0, 0.35, 1] as const;
const PAPER = "var(--pipeline-paper)";

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
      <path d="M-13,-8 L18,0 L-13,8 L-6,0 Z" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M-6,0 L18,0 M-13,8 L-6,0" fill="none" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M-13,-8 L-6,0 L-13,8 Z" fill="var(--pipeline-faint-ink)" />
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

    const currentRunId = runId;
    runCycle();
    return () => {
      // Invalidate the active loop so it stops on unmount / remount.
      currentRunId.current++;
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
                  <ellipse cx="0" cy="40" rx="30" ry="6" fill="var(--pipeline-faint-ink)" />

                  {/* paper tile */}
                  <g transform={`rotate(${rot})`}>
                    <rect
                      x="-33"
                      y="-31"
                      width="66"
                      height="62"
                      rx="11"
                      fill={PAPER}
                      stroke={INK}
                      strokeWidth="2.2"
                      style={{
                        filter: isReached
                          ? `drop-shadow(2px 4px 0px ${stage.base}66)`
                          : "drop-shadow(2px 3px 0px var(--pipeline-faint-ink))",
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

                {/* caption tooltip — sits right above the current/ongoing step.
                    Position is driven through motion's x/y values (not a transform
                    attribute, which motion would override and drop to the origin). */}
                <AnimatePresence>
                  {isFocus && (
                    <motion.g
                      style={{ x: pt.x, y: pt.y - 50 }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      <motion.g
                        initial={{ y: 8 }}
                        animate={{ y: 0 }}
                        exit={{ y: 8 }}
                        transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      >
                        <rect
                          x="-66"
                          y="-21"
                          width="132"
                          height="28"
                          rx="8"
                          fill={PAPER}
                          stroke={INK}
                          strokeWidth="1.8"
                          style={{ filter: "drop-shadow(2px 3px 0px var(--pipeline-shadow))" }}
                        />
                        <path d="M-6,6 L0,13 L6,6 Z" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
                        <rect x="-6" y="5" width="12" height="3" fill={PAPER} />
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
