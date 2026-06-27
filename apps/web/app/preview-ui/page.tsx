"use client";

// TEMPORARY showcase route for visual verification of the design revamp.
// Renders the revamped components with mock data so they can be screenshotted
// without auth or a backend. Safe to delete.

import NewProjectBox from "../dashboard/_components/new-project-box";
import AssemblyPanel from "../dashboard/_components/assembly-panel";
import PreviewPanel from "../dashboard/_components/preview-panel";
import type { GeneratedFile, LayoutSpec, Stage } from "../dashboard/_lib/projects";

const spec: LayoutSpec = {
  screen: "Waitlist landing page",
  sections: [
    { type: "navbar", items: ["Home", "Features", "Pricing"], cta: "Join" },
    { type: "hero", title: "Join the waitlist", subtitle: "Be the first to know when we launch.", cta: "Get early access" },
    { type: "features", title: "Why join", items: ["Early access", "Founder pricing", "Shape the roadmap"] },
    { type: "cta", title: "Ready to start?", cta: "Join now" },
    { type: "footer", items: ["About", "Contact", "Privacy"] },
  ],
};

const stages: Stage[] = [
  { id: "1", projectId: "p", type: "tasks", status: "completed", order: 4 },
  { id: "2", projectId: "p", type: "implementation", status: "running", order: 5 },
  { id: "3", projectId: "p", type: "review", status: "pending", order: 6 },
  { id: "4", projectId: "p", type: "fixes", status: "pending", order: 7 },
];

const files: GeneratedFile[] = [
  {
    path: "index.html",
    content:
      "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<style>body{font-family:system-ui;margin:0;background:#fff;color:#171717}" +
      ".h{padding:72px 24px;text-align:center}h1{font-size:34px;letter-spacing:-1px;margin:0 0 10px}" +
      "p{color:#666;margin:0}.row{margin-top:20px;display:flex;gap:8px;justify-content:center}" +
      "input{height:42px;padding:0 12px;border:1px solid #eaeaea;border-radius:8px;width:240px}" +
      ".b{height:42px;display:inline-flex;align-items:center;background:#111;color:#fff;padding:0 16px;border-radius:8px;text-decoration:none}" +
      "</style></head><body><div class='h'><h1>Join the waitlist</h1>" +
      "<p>Be the first to know when we launch.</p>" +
      "<div class='row'><input placeholder='you@email.com'/><a class='b' href='#'>Get early access</a></div>" +
      "</div></body></html>",
  },
];

export default function PreviewUiPage() {
  return (
    <div className="min-h-screen bg-[var(--background-200)] px-6 py-10 text-[var(--gray-1000)]">
      <div className="mx-auto max-w-6xl space-y-12">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">UI preview (temporary)</h1>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--gray-700)]">Idea composer</h2>
          <NewProjectBox onCreated={() => {}} />
        </section>

        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--gray-700)]">Studio — assembly (mid-build) + preview</h2>
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <AssemblyPanel spec={spec} stages={stages} projectStatus="running" />
            <PreviewPanel projectId="demo" files={files} entry="index.html" initialDeploymentUrl={null} />
          </div>
        </section>
      </div>
    </div>
  );
}
