"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { deleteAllProjects } from "../_lib/projects";

interface DeleteAllProjectsModalProps {
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteAllProjectsModal({ onClose, onDeleted }: DeleteAllProjectsModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: deleteAllProjects,
    onSuccess: onDeleted,
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong."),
  });

  const canDelete = confirmText === "DELETE ALL";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded border border-[var(--border-default)] bg-[var(--bg-raised)] p-6 shadow-xl">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-1">Delete all projects?</h2>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5">
          This permanently deletes <strong className="text-red-600">ALL</strong> your projects, including their
          associated files, messages, and sandbox environments. This action is irreversible.
        </p>

        <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
          Type <span className="font-bold text-[var(--text-primary)]">DELETE ALL</span> to confirm
        </label>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canDelete && !isPending) mutate(); }}
          placeholder="DELETE ALL"
          className="w-full rounded border border-[var(--border-default)] bg-[var(--bg-inset)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--border-strong)] focus:outline-none mb-4"
        />

        {error && <p className="mb-3 text-[12px] text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="cs-btn cs-btn-sm cs-btn-outline"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutate()}
            disabled={!canDelete || isPending}
            className="cs-btn cs-btn-sm cs-btn-solid bg-red-600 border-red-600 text-white hover:bg-red-700 hover:border-red-700 disabled:opacity-40"
          >
            {isPending ? "Deleting…" : "Delete all projects"}
          </button>
        </div>
      </div>
    </div>
  );
}
