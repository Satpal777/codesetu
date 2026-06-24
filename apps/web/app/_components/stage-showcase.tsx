"use client";

import { motion } from "motion/react";
import { STAGES } from "./stage-data";

/* ------------------------------------------------------------------ *
 * Stage Showcase (Geist)
 *
 * The six pipeline stages as a clean, minimal grid. Each card carries
 * its step number, a small accent dot tying it to the idea→production
 * animation above, a title, and a one-line caption. Tonal surfaces and
 * a subtle border do the work; color only signals the stage.
 * ------------------------------------------------------------------ */

const EASE = [0.175, 0.885, 0.32, 1.1] as const;

export default function StageShowcase() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {STAGES.map((stage, i) => (
        <motion.div
          key={stage.id}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
          className="geist-card p-6"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-[#8f8f8f]">{String(i + 1).padStart(2, "0")}</span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: stage.base }}
              aria-hidden
            />
          </div>
          <h3 className="mt-8 text-lg font-semibold tracking-tight text-[#171717]">{stage.label}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#4d4d4d]">{stage.caption}</p>
        </motion.div>
      ))}
    </div>
  );
}
