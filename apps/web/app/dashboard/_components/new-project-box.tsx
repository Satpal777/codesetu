"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject, type Project } from "../_lib/projects";
import ModelPicker, { type ModelSelection } from "./model-picker";

export default function NewProjectBox({ onCreated }: { onCreated: (project: Project) => void }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [models, setModels] = useState<ModelSelection>({ defaultModelId: "", overrides: {} });
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
        defaultModelId: models.defaultModelId,
        overrides: models.overrides,
      });
      setPrompt("");
      onCreated(project);
      // Navigate to the live pipeline view immediately.
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
    <div className="rounded-2xl border border-[var(--gray-alpha-300)] bg-[var(--background-100)] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-6">
      <label htmlFor="new-project-prompt" className="block text-sm font-medium text-[var(--gray-1000)]">
        Start a new project
      </label>
      <p className="mt-1 text-[13px] text-[var(--gray-700)]">
        Describe what you want to ship. ShipFlow plans, builds, reviews, and releases it.
      </p>

      <textarea
        id="new-project-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        placeholder="e.g. A waitlist page with email capture and a CSV export for admins."
        className="mt-4 w-full resize-none rounded-xl border border-[var(--gray-alpha-300)] bg-[var(--field-background)] px-4 py-3 text-[15px] leading-relaxed text-[var(--gray-1000)] placeholder:text-[var(--gray-600)] focus:border-[var(--gray-1000)] focus:bg-[var(--field-background-focus)] focus:outline-none"
      />

      <div className="mt-4 border-t border-[var(--gray-alpha-100)] pt-4">
        <ModelPicker onChange={setModels} />
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
          {submitting ? "Starting…" : "Start pipeline →"}
        </button>
      </div>
    </div>
  );
}
