"use client";

import { useEffect, useRef } from "react";
import { SparklesCore } from "./ui/sparkles";

/**
 * BridgeFlow — the "watch an idea cross the bridge" animation.
 *
 * A comet travels an arc from IDEA to DEPLOY; the bridge deck fills in behind
 * it and each of the seven stage nodes blooms as the comet reaches it, then the
 * run resets and loops.
 *
 * Colours are entirely CSS-driven (via the `--flow-*` tokens in globals.css), so
 * the animation re-themes instantly between light and dark. JS only toggles the
 * `.is-on` class and drives geometry (dash offset, transforms, opacity).
 *
 * Honors prefers-reduced-motion by rendering the completed end state with no
 * looping motion.
 */

// Geometry — matches the design's viewBox "70 0 1060 282".
const NODE_X = [154, 303, 452, 600, 749, 897, 1046];
const NODE_Y = [193, 136, 101, 90, 101, 136, 193];
const LABELS = ["Idea", "Iterate", "Document", "To-dos", "Code", "Preview", "Deploy"];
const INDICES = ["01", "02", "03", "04", "05", "06", "07"];
const PATH_D = "M80 230 Q600 -50 1120 230";

const DUR = 4200; // one full crossing (ms)
const HOLD = 1500; // pause at the far side before looping (ms)

// Seven lucide-style stage glyphs, drawn at 24×24 and placed at translate(-12,-12).
const ICONS = [
  <g key="0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 21h4" />
    <path d="M12 3a6 6 0 0 0-4 10.5c.8.7 1 1.3 1 2.5h6c0-1.2.2-1.8 1-2.5A6 6 0 0 0 12 3Z" />
  </g>,
  <g key="1" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
  </g>,
  <g key="2" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" />
  </g>,
  <g key="3" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" />
    <path d="m3 6 1 1 2-2" /><path d="m3 12 1 1 2-2" /><path d="m3 18 1 1 2-2" />
  </g>,
  <g key="4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m13.5 5.5-3 13" />
  </g>,
  <g key="5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="15" rx="2" /><path d="M3 9h18" />
    <circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" /><path d="M10 21h4" />
  </g>,
  <g key="6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2 0-3s-2.2-.8-3 0Z" />
    <path d="m12 15-3-3a12 12 0 0 1 7-8 6 6 0 0 1 4 4 12 12 0 0 1-8 7Z" />
    <circle cx="15" cy="9" r="1.5" />
  </g>,
];

export default function BridgeFlow() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const svg = root.querySelector<SVGSVGElement>("#flow-svg");
    const base = root.querySelector<SVGPathElement>("#flow-base");
    const fill = root.querySelector<SVGPathElement>("#flow-fill");
    const comet = root.querySelector<SVGGElement>("#comet");
    if (!svg || !base || !fill || !comet) return;

    const trail = Array.from(svg.querySelectorAll<SVGCircleElement>(".ctrail"));
    const N = NODE_X.length;
    const total = base.getTotalLength();
    fill.style.strokeDasharray = `${total} ${total}`;

    // Arc-length position closest to each node's x, so nodes bloom in step.
    const lenAt = NODE_X.map((tx) => {
      let best = 0;
      let bestD = Infinity;
      for (let L = 0; L <= total; L += total / 600) {
        const p = base.getPointAtLength(L);
        const d = Math.abs(p.x - tx);
        if (d < bestD) {
          bestD = d;
          best = L;
        }
      }
      return best;
    });

    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);

    const setNode = (i: number, on: boolean, pulse: boolean) => {
      const box = q<SVGGElement>(`#n${i}`);
      const label = q<SVGTextElement>(`#l${i}`);
      const idx = q<SVGTextElement>(`#x${i}`);
      const glow = q<SVGCircleElement>(`#g${i}`);
      if (!box) return;

      box.classList.toggle("is-on", on);
      label?.classList.toggle("is-on", on);
      idx?.classList.toggle("is-on", on);

      if (on && pulse) {
        const nx = NODE_X[i] ?? 0;
        const ny = NODE_Y[i] ?? 0;
        const at = `translate(${nx}px,${ny}px)`;
        box.animate(
          [
            { transform: `${at} scale(1)` },
            { transform: `${at} scale(1.16)` },
            { transform: `${at} scale(1)` },
          ],
          { duration: 550, easing: "cubic-bezier(0.2,0,0,1)" }
        );
        if (glow) {
          glow.style.transformBox = "fill-box";
          glow.style.transformOrigin = "center";
          glow.animate(
            [
              { opacity: 0, transform: "scale(0.6)" },
              { opacity: 0.16, transform: "scale(1.1)" },
              { opacity: 0, transform: "scale(1.5)" },
            ],
            { duration: 900, easing: "ease-out" }
          );
        }
      }
    };

    const resetAll = () => {
      fill.style.strokeDashoffset = String(total);
      comet.style.opacity = "0";
      trail.forEach((t) => (t.style.opacity = "0"));
      for (let i = 0; i < N; i++) setNode(i, false, false);
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      fill.style.strokeDashoffset = "0";
      comet.style.opacity = "0";
      for (let i = 0; i < N; i++) setNode(i, true, false);
      return;
    }

    let raf = 0;
    let startT = 0;
    let firedTo = -1;
    let started = false;
    let holdTimer = 0;

    const frame = (now: number) => {
      if (!startT) startT = now;
      let t = (now - startT) / DUR;
      if (t > 1) t = 1;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const L = ease * total;

      fill.style.strokeDashoffset = String(total - L);

      const pt = base.getPointAtLength(L);
      comet.setAttribute("transform", `translate(${pt.x},${pt.y})`);
      comet.style.opacity = t > 0.001 && t < 0.999 ? "1" : "0";

      trail.forEach((tr, k) => {
        const lag = (k + 1) * total * 0.018;
        const tl = Math.max(0, L - lag);
        const tp = base.getPointAtLength(tl);
        tr.setAttribute("transform", `translate(${tp.x},${tp.y})`);
        tr.style.opacity = t > 0.02 && t < 0.98 ? String(0.5 - k * 0.09) : "0";
      });

      for (let i = firedTo + 1; i < N; i++) {
        const target = lenAt[i];
        if (target !== undefined && L >= target - 2) {
          setNode(i, true, true);
          firedTo = i;
        }
      }

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        comet.style.opacity = "0";
        trail.forEach((tr) => (tr.style.opacity = "0"));
        holdTimer = window.setTimeout(() => {
          resetAll();
          startT = 0;
          firedTo = -1;
          raf = requestAnimationFrame(frame);
        }, HOLD);
      }
    };

    const begin = () => {
      if (started) return;
      started = true;
      raf = requestAnimationFrame(frame);
    };

    resetAll();

    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              begin();
              io?.disconnect();
            }
          });
        },
        { threshold: 0.2 }
      );
      io.observe(root);
    }
    const checkVisible = () => {
      if (started) return;
      const r = root.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) * 0.85 && r.bottom > 0) begin();
      else holdTimer = window.setTimeout(checkVisible, 300);
    };
    const visTimer = window.setTimeout(checkVisible, 200);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (holdTimer) clearTimeout(holdTimer);
      clearTimeout(visTimer);
      io?.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative px-2">
      <svg
        id="flow-svg"
        viewBox="70 0 1060 282"
        className="block h-auto w-full overflow-visible"
        role="img"
        aria-label="Animated flow: an idea travels across the bridge through Iterate, Document, To-dos, Code and Preview to Deploy."
      >
        <defs>
          {ICONS.map((icon, i) => (
            <g key={i} id={`ic-${i}`}>
              {icon}
            </g>
          ))}
          <clipPath id="sparkles-clip">
            <path d={`${PATH_D} L1120 300 L80 300 Z`} />
          </clipPath>
        </defs>

        <foreignObject x="70" y="0" width="1060" height="282" clipPath="url(#sparkles-clip)">
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--white)] to-transparent z-10 pointer-events-none" />
            <SparklesCore
              background="transparent"
              minSize={1.2}
              maxSize={3}
              particleDensity={150}
              className="w-full h-full"
              particleColor="#4f46e5"
              speed={0.8}
              direction="top"
            />
          </div>
        </foreignObject>

        {/* The arch: faint dotted track + bright deck that fills behind the comet */}
        <path id="flow-base" className="cs-flow-base" d={PATH_D} fill="none" strokeWidth={2} strokeLinecap="round" strokeDasharray="1 8" />
        <path id="flow-fill" className="cs-flow-fill" d={PATH_D} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="0 100000" />

        {/* Node glows (behind boxes) */}
        {NODE_X.map((x, i) => (
          <circle key={`g${i}`} id={`g${i}`} className="cs-flow-glow" cx={x} cy={NODE_Y[i]} r={30} opacity={0} />
        ))}

        {/* Node boxes */}
        {NODE_X.map((x, i) => (
          <g key={`n${i}`} id={`n${i}`} className="cs-flow-node" transform={`translate(${x},${NODE_Y[i]})`}>
            <rect x={-30} y={-30} width={60} height={60} rx={4} strokeWidth={1.5} />
            <g className="ic" transform="translate(-12,-12)">
              <use href={`#ic-${i}`} />
            </g>
          </g>
        ))}

        {/* Labels + indices */}
        {NODE_X.map((x, i) => {
          const y = NODE_Y[i] ?? 0;
          return (
            <g key={`t${i}`}>
              <text
                id={`l${i}`}
                className="cs-flow-label"
                x={x}
                y={y + 50}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-mono-cs)", fontSize: "13px", letterSpacing: "1.4px", textTransform: "uppercase" }}
              >
                {LABELS[i]}
              </text>
              <text
                id={`x${i}`}
                className="cs-flow-idx"
                x={x}
                y={y + 68}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-mono-cs)", fontSize: "11px" }}
              >
                {INDICES[i]}
              </text>
            </g>
          );
        })}

        {/* Comet trail + head */}
        <g id="flow-trail" className="cs-flow-trail">
          {[5, 4.4, 3.8, 3.2, 2.6].map((r, i) => (
            <circle key={i} className="ctrail" r={r} opacity={0} />
          ))}
        </g>
        <g id="comet" opacity={0}>
          <circle className="cs-flow-comet-halo" r={22} opacity={0.12} />
          <circle className="cs-flow-comet-halo" r={12} opacity={0.12} />
          <circle className="cs-flow-comet-core" r={6.5} />
          <circle className="cs-flow-comet-inner" r={2.5} opacity={0.9} />
        </g>
      </svg>
    </div>
  );
}
