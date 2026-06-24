"use client";

import { useState } from "react";
import { createProject, type Project } from "../_lib/projects";

/**
 * The primary action of the dashboard: describe a product in plain words and
 * start a pipeline. Deliberately calm — one field, one button, room to think.
 */
export default function NewProjectBox({ onCreated }: { onCreated: (project: Project) => void }) {
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = prompt.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({ prompt: prompt.trim() });
      setPrompt("");
      onCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // ⌘/Ctrl + Enter to start, the way you'd expect from a prompt box.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="rounded-2xl border border-[#0000001a] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-6">
      <label htmlFor="new-project-prompt" className="block text-sm font-medium text-[#171717]">
        Start a new project
      </label>
      <p className="mt-1 text-[13px] text-[#8f8f8f]">
        Describe what you want to ship. CodeSetu plans, builds, reviews, and releases it.
      </p>

      <textarea
        id="new-project-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="e.g. A waitlist page with email capture and a CSV export for admins."
        className="mt-4 w-full resize-none rounded-xl border border-[#0000001a] bg-[#fafafa] px-4 py-3 text-[15px] leading-relaxed text-[#171717] placeholder:text-[#a8a8a8] focus:border-[#171717] focus:bg-white"
      />

      {error && <p className="mt-3 text-[13px] text-[#d8001b]">{error}</p>}

      <div className="mt-4 flex items-center justify-between">
        <span className="hidden text-[12px] text-[#a8a8a8] sm:inline">
          Press <kbd className="font-mono text-[#8f8f8f]">⌘</kbd>
          <kbd className="font-mono text-[#8f8f8f]">↵</kbd> to start
        </span>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="geist-btn geist-btn-primary ml-auto disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Starting…" : "Start pipeline"}
        </button>
      </div>
    </div>
  );
}
