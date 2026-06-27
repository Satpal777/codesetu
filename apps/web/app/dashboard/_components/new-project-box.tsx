"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createProject, type Project } from "../_lib/projects";
import ModelPicker, { type ModelSelection } from "./model-picker";

type Mode = "copilot" | "autopilot";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "copilot", label: "Co-pilot", blurb: "We check in with you before going live." },
  { id: "autopilot", label: "Autopilot", blurb: "We build the whole thing in one go." },
];

const EXAMPLES = [
  "A waitlist page that collects emails",
  "A simple habit tracker",
  "A portfolio with a contact form",
  "A landing page for a coffee shop",
];

export default function NewProjectBox({ onCreated }: { onCreated: (project: Project) => void }) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("copilot");
  const [models, setModels] = useState<ModelSelection>({ defaultModelId: "", overrides: {} });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = prompt.trim().length >= 10 && !submitting;

  const useExample = (text: string) => {
    setPrompt(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

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
    <div className="rounded-2xl border border-[var(--gray-alpha-300)] bg-[var(--background-100)] p-5 shadow-[0_2px_2px_rgba(0,0,0,0.04)] md:p-6">
      <label htmlFor="new-project-prompt" className="block text-[15px] font-semibold tracking-[-0.01em] text-[var(--gray-1000)]">
        What do you want to make?
      </label>
      <p className="mt-1 text-[13px] text-[var(--gray-700)]">
        Describe your idea in plain words. We&apos;ll ask a couple of questions, then build it for you.
      </p>

      {/* Idea composer — glows on focus. */}
      <div className="composer-focus mt-4 rounded-xl border border-[var(--gray-alpha-300)] bg-[var(--field-background)] transition-[box-shadow,border-color] duration-150">
        <textarea
          ref={textareaRef}
          id="new-project-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          placeholder="e.g. A simple page where people can join a waitlist with their email."
          className="w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-[var(--gray-1000)] placeholder:text-[var(--gray-600)] focus:outline-none"
        />
      </div>

      {/* Example ideas — fill the composer on tap. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-[var(--gray-600)]">Try one:</span>
        {EXAMPLES.map((ex, i) => (
          <button
            key={ex}
            type="button"
            onClick={() => useExample(ex)}
            style={{ animationDelay: `${i * 50}ms` }}
            className="press animate-rise rounded-full border border-[var(--gray-alpha-300)] bg-[var(--background-100)] px-3 py-1 text-[12px] text-[var(--gray-900)] hover:border-[var(--gray-alpha-500)] hover:text-[var(--gray-1000)]"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* How should we work? — sliding spring pill. */}
      <div className="mt-5">
        <p className="text-[13px] font-medium text-[var(--gray-1000)]">How should we work?</p>
        <div className="mt-2 inline-flex rounded-lg border border-[var(--gray-alpha-300)] bg-[var(--background-200)] p-0.5">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={active}
                className="press relative z-10 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
                style={{ color: active ? "var(--gray-1000)" : "var(--gray-700)" }}
              >
                {active && (
                  <motion.span
                    layoutId="mode-pill"
                    transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                    className="absolute inset-0 -z-10 rounded-md bg-[var(--background-100)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  />
                )}
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[12px] text-[var(--gray-600)]">{MODES.find((m) => m.id === mode)?.blurb}</p>
      </div>

      {/* Advanced: model picker, tucked away from non-technical users. */}
      <div className="mt-4 border-t border-[var(--gray-alpha-100)] pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--gray-700)] hover:text-[var(--gray-1000)]"
        >
          <span className="text-[10px]">{showAdvanced ? "▼" : "▶"}</span>
          Advanced options
        </button>
        {showAdvanced && (
          <div className="mt-3">
            <ModelPicker onChange={setModels} />
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-[13px] text-[var(--red-900)]">{error}</p>}

      <div className="mt-4 flex items-center justify-between">
        <span className="hidden text-[12px] text-[var(--gray-600)] sm:inline">
          Press <kbd className="font-mono text-[var(--gray-700)]">⌘</kbd>
          <kbd className="font-mono text-[var(--gray-700)]">↵</kbd> to start
        </span>
        <button
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="geist-btn geist-btn-primary ml-auto disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Starting…" : "Build it →"}
        </button>
      </div>
    </div>
  );
}
