"use client";

import { useParams } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export default function PublicPreviewPage() {
  const params = useParams();
  const token = params.token as string;
  const previewSrc = `${BACKEND_URL}/api/share/${token}/`;

  return (
    <div className="flex h-screen flex-col bg-black">
      {/* Minimal branding bar */}
      <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
        <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">
          Built with CodeSetu
        </span>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="rounded border border-white/20 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60 transition-colors hover:border-white/40 hover:text-white/90"
        >
          Build yours →
        </a>
      </div>
      <iframe src={previewSrc} className="flex-1 w-full border-0" title="Live preview" />
    </div>
  );
}
