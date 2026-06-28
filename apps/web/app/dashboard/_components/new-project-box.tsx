"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { createProject, type Project } from "../_lib/projects";
import ModelPicker, { type ModelSelection } from "./model-picker";

type Mode = "copilot" | "autopilot";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "copilot", label: "Co-pilot", blurb: "We check in with you before going live." },
  { id: "autopilot", label: "Autopilot", blurb: "We build the whole thing in one go." },
];

export default function NewProjectBox({
  onCreated,
  prompt: externalPrompt,
  setPrompt: externalSetPrompt,
}: {
  onCreated: (project: Project) => void;
  prompt?: string;
  setPrompt?: (val: string) => void;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localPrompt, setLocalPrompt] = useState("");
  const prompt = externalPrompt !== undefined ? externalPrompt : localPrompt;
  const setPrompt = externalSetPrompt !== undefined ? externalSetPrompt : setLocalPrompt;
  
  const [mode, setMode] = useState<Mode>("copilot");
  const [models, setModels] = useState<ModelSelection>({ defaultModelId: "", overrides: {} });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = prompt.trim().length >= 10 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        prompt: prompt.trim(),
        autopilot: mode === "autopilot",
        defaultModelId: models.defaultModelId,
        overrides: models.overrides,
      });
      setPrompt("");
      onCreated(project);
      router.push(`/dashboard/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="w-full">
      {/* PromptInput */}
      <div className="border border-[var(--border-strong)] rounded-lg bg-[var(--bg-raised)] shadow-[var(--shadow-md)] overflow-hidden transition-all focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
        <textarea
          ref={textareaRef}
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe what you want to build — a product, a tool, a page, an API…"
          className="display-block w-full resize-none bg-transparent px-[18px] py-4 text-[15px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
        />

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={`flex h-7 w-7 items-center justify-center rounded-[4px] border transition-colors ${
                showAdvanced
                  ? "border-[var(--border-strong)] bg-[var(--ink-950)] text-white"
                  : "border-[var(--border-default)] bg-[var(--bg-raised)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
              title="Advanced options"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <span className="font-mono text-[11px] text-[var(--text-tertiary)]">{prompt.length} / 2000</span>
          </div>

          <div className="flex items-center gap-3.5">
            <span className="font-mono text-[11px] tracking-wide text-[var(--text-tertiary)]">⌘↵</span>
            <button
              onClick={() => void submit()}
              disabled={!canSubmit}
              className="cs-btn cs-btn-sm cs-btn-solid font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Starting…" : "Build →"}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-4 shadow-sm">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Execution Mode</p>
              <div className="mt-2 inline-flex rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)] p-0.5">
                {MODES.map((m) => {
                  const active = mode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMode(m.id)}
                      className={`relative rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        active ? "bg-white text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                {MODES.find((m) => m.id === mode)?.blurb}
              </p>

              <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                <ModelPicker onChange={setModels} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
