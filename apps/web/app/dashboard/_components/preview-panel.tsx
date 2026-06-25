"use client";

import { useMemo, useState } from "react";
import { buildPreviewHtml, deployProject, type GeneratedFile } from "../_lib/projects";

interface Props {
  projectId: string;
  files: GeneratedFile[];
  entry: string;
  initialDeploymentUrl?: string | null;
}

export default function PreviewPanel({ projectId, files, entry, initialDeploymentUrl }: Props) {
  const html = useMemo(() => buildPreviewHtml(files, entry), [files, entry]);
  const [deployUrl, setDeployUrl] = useState<string | null>(initialDeploymentUrl ?? null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openInNewTab = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    // Revoke a little later so the new tab has time to load.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const publish = async () => {
    if (publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const url = await deployProject(projectId);
      setDeployUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-[var(--gray-1000)]">Your app, live</p>
          <p className="text-[11px] text-[var(--gray-600)]">
            {deployUrl ? "Published and ready to share." : "Running right here — try it out."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openInNewTab}
            className="geist-btn geist-btn-secondary h-8 text-[13px]"
          >
            Open in new tab
          </button>
          {deployUrl ? (
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="geist-btn geist-btn-primary h-8 text-[13px]"
            >
              View live ↗
            </a>
          ) : (
            <button
              onClick={() => void publish()}
              disabled={publishing}
              className="geist-btn geist-btn-primary h-8 text-[13px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {publishing ? "Publishing…" : "Publish →"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-[12px] text-[var(--red-900)]">{error}</p>}

      {deployUrl && (
        <p className="mb-3 truncate text-[12px] text-[var(--gray-700)]">
          Live at{" "}
          <a href={deployUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--blue-700)] hover:underline">
            {deployUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
      )}

      {/* Sandboxed iframe — the app runs in an isolated origin (no same-origin access). */}
      <div className="overflow-hidden rounded-xl border border-[var(--gray-alpha-200)] bg-white">
        <div className="flex h-8 items-center gap-1.5 border-b border-[var(--gray-alpha-200)] bg-[var(--background-200)] px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
        </div>
        <iframe
          title="App preview"
          srcDoc={html}
          sandbox="allow-scripts allow-forms allow-popups"
          className="h-[520px] w-full bg-white"
        />
      </div>
    </div>
  );
}
