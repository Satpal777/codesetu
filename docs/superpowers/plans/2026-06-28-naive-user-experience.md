# Naive User Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CodeSetu immediately valuable to a non-technical user by abstracting SDLC complexity, adding templates, surfacing a shareable live URL, and making post-build iteration feel natural.

**Architecture:** Four independent layers: (1) pure-UI SDLC abstraction with a dev-mode toggle, (2) a curated template gallery that pre-fills the composer, (3) a DB-backed share token giving unauthenticated public access to a project's preview, (4) quick-action chips in the agent workspace for zero-friction iteration. No new backend services — extend what exists.

**Tech Stack:** Next.js 14 (app router), React Query, Drizzle ORM, Express, TypeScript, Tailwind + CSS tokens (`var(--*)`)

## Global Constraints

- All CSS uses existing design tokens (`var(--bg-raised)`, `var(--text-primary)`, etc.) — no raw hex except the ink ramp already in globals
- No new npm packages unless unavoidable — use what is already installed (`motion/react`, `@tanstack/react-query`, `nanoid` already present in server)
- Migrations: `pnpm --filter @repo/database db:generate` then `pnpm --filter @repo/database db:migrate`
- All backend endpoints must check `req.user` ownership before serving data — **except** the new public share preview endpoint which is intentionally public
- Dev-mode state lives in `localStorage` key `"cs_dev_mode"` — no server persistence needed

---

## File Map

| File | Change |
|------|--------|
| `packages/database/src/schema.ts` | Add `shareToken text` column to `project` table |
| `packages/database/drizzle/` | New migration file (auto-generated) |
| `apps/server/src/modules/projects/projects.controller.ts` | Populate `shareToken` on project create |
| `apps/server/src/modules/agent/agent.controller.ts` | Add `GET /api/share/:token/*` public preview handler |
| `apps/server/src/app.ts` | Register new `/api/share` route (check existing router setup) |
| `apps/web/app/dashboard/[id]/page.tsx` | SDLC abstraction: simple/dev mode toggle on build view; share URL card in completed view |
| `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx` | Add quick-action chips, share URL copy button |
| `apps/web/app/dashboard/page.tsx` | Add template gallery section above the composer |
| `apps/web/app/dashboard/_lib/projects.ts` | Add `shareToken` to `Project` type; add `getShareUrl()` helper |

---

## Task 1: Template Gallery (frontend only, no deps)

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Interfaces:**
- Produces: clicking a template card calls `setPrompt(template.prompt)` and scrolls to the composer

- [ ] **Step 1: Add the template data array** inside `apps/web/app/dashboard/page.tsx`, just after the `SUGGESTIONS` array (around line 17):

```tsx
const TEMPLATES: { icon: string; title: string; prompt: string }[] = [
  {
    icon: "🛍️",
    title: "Product landing page",
    prompt: "A modern landing page for my SaaS product with a hero section, features grid, pricing table, and email signup form.",
  },
  {
    icon: "📋",
    title: "Admin dashboard",
    prompt: "An internal admin dashboard with a sidebar navigation, summary stat cards, a data table with search and filter, and a simple chart.",
  },
  {
    icon: "📝",
    title: "Blog / marketing site",
    prompt: "A clean marketing site with a blog. Include a hero, feature sections, a blog index page, and individual article layout.",
  },
  {
    icon: "⚡",
    title: "Waitlist page",
    prompt: "A high-converting waitlist page with a bold headline, short value proposition, email capture form, and social proof counter.",
  },
  {
    icon: "🧾",
    title: "Invoice tool",
    prompt: "A simple invoice generator tool where I can fill in client name, line items with quantities and prices, and print or download as PDF.",
  },
  {
    icon: "📊",
    title: "Portfolio site",
    prompt: "A personal portfolio site for a designer or developer. Include an about section, project cards with thumbnails, skills list, and contact form.",
  },
];
```

- [ ] **Step 2: Add a `composerRef` to scroll to after template selection** — replace the existing `const [prompt, setPrompt] = useState("")` section (around line 56) with:

```tsx
const [prompt, setPrompt] = useState("");
const composerRef = useRef<HTMLDivElement>(null);

const handleTemplateClick = (templatePrompt: string) => {
  setPrompt(templatePrompt);
  setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
};
```

Also add `useRef` to the import on line 2: `import { useState, useRef } from "react";`

- [ ] **Step 3: Insert the template gallery JSX** inside the returned JSX, between the greeting `<h1>` (line 97) and the suggestions chips `<div>` (line 100). Replace that section with:

```tsx
{/* Template Gallery */}
<div className="mb-8">
  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)] mb-3">
    Start from a template
  </p>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    {TEMPLATES.map((t) => (
      <button
        key={t.title}
        type="button"
        onClick={() => handleTemplateClick(t.prompt)}
        className="press group flex items-center gap-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--fill-muted)]"
      >
        <span className="text-[18px] leading-none">{t.icon}</span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{t.title}</span>
      </button>
    ))}
  </div>
</div>

{/* Suggestion Chips */}
<div className="flex flex-wrap gap-2 mb-3.5">
  {SUGGESTIONS.map((sug) => (
    <button
      key={sug}
      type="button"
      onClick={() => setPrompt(sug)}
      className="press cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-1 font-mono text-[11px] tracking-wide text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
    >
      {sug}
    </button>
  ))}
</div>

{/* Composer Box */}
<div ref={composerRef}>
  <NewProjectBox onCreated={handleProjectCreated} prompt={prompt} setPrompt={setPrompt} />
</div>
```

Remove the old `{/* Composer Box */}` block (the one without the `ref` wrapper) that was previously below the suggestions.

- [ ] **Step 4: Verify visually** — start the web dev server (`pnpm --filter web dev`) and open `http://localhost:3000/dashboard`. You should see 6 template cards in a 2-3 col grid above the suggestion chips. Clicking a card fills the textarea and scrolls to it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat(dashboard): add template gallery with 6 starter templates"
```

---

## Task 2: SDLC Abstraction — Simple / Dev Mode Toggle (frontend only, no deps)

The build view currently shows 10 labelled stages (PRD, WBS, etc.) that mean nothing to a naive user. Default to "Simple mode" (friendly progress bar + "Building your app..." status). A toggle reveals the full stage checklist for power users. State persists in `localStorage`.

**Files:**
- Modify: `apps/web/app/dashboard/[id]/page.tsx`

**Interfaces:**
- Produces: `devMode: boolean` state, toggled by a small "Dev mode" button in the header

- [ ] **Step 1: Add `devMode` state** — inside `ProjectDetailPage`, just after the `const [projectId, setProjectId]` declaration (around line 313), add:

```tsx
const [devMode, setDevMode] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("cs_dev_mode") === "true";
});

const toggleDevMode = () => {
  setDevMode((prev) => {
    const next = !prev;
    localStorage.setItem("cs_dev_mode", String(next));
    return next;
  });
};
```

- [ ] **Step 2: Add the Dev Mode toggle button** to the header bar — in the `<div className="flex items-center gap-4">` on the right of the header (around line 533), add before `<ThemeSwitch />`:

```tsx
<button
  onClick={toggleDevMode}
  title={devMode ? "Switch to simple view" : "Switch to developer view"}
  className={`flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
    devMode
      ? "border-[var(--border-strong)] bg-[var(--ink-950)] text-white"
      : "border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
  }`}
>
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
  Dev
</button>
```

- [ ] **Step 3: Add a `SimpleProgressView` component** — insert this new component definition just above `ProjectDetailPage` (around line 307):

```tsx
function SimpleProgressView({ activeStageIndex, totalStages, activeStageType }: {
  activeStageIndex: number;
  totalStages: number;
  activeStageType: StageType;
}) {
  const FRIENDLY_LABELS: Record<StageType, string> = {
    request: "Understanding your idea…",
    product_thinking: "Thinking through your users…",
    prd: "Writing out what to build…",
    design: "Sketching the layout…",
    tasks: "Planning the build steps…",
    implementation: "Writing your app…",
    review: "Checking for issues…",
    fixes: "Polishing…",
    approval: "Almost ready to go live…",
    release: "Deploying to the web…",
  };

  const pct = Math.round(((activeStageIndex + 1) / totalStages) * 100);

  return (
    <div className="mx-auto max-w-lg w-full px-6 py-20 flex flex-col items-center gap-6">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--bg-inset)] border-t-[var(--ink-950)]" />
      <div className="w-full text-center">
        <p className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
          {FRIENDLY_LABELS[activeStageType] ?? "Building your app…"}
        </p>
        <p className="font-mono text-[11px] text-[var(--text-tertiary)]">{pct}% complete</p>
      </div>
      <div className="h-[3px] w-full max-w-xs bg-[var(--bg-inset)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--ink-950)] rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)] text-center max-w-xs">
        Your app is being built in the background — we'll switch you to the live editor as soon as it's ready.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Swap the build view to use `devMode`** — find the `{/* ══ Active Build ══ */}` block (around line 604). Replace the outer condition that shows the stages checklist:

```tsx
) : (
  /* ══ Active Build: Progress or full stage checklist ══ */
  <div className="flex-1">
    {devMode ? (
      /* Developer mode — full SDLC stage checklist + log visualizer */
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_2.2fr] gap-8 items-start">
          {/* LEFT — stages checklist (existing JSX, unchanged) */}
          ...existing stages checklist JSX...
          {/* RIGHT — log visualizer + artifact preview (existing JSX, unchanged) */}
          ...existing right column JSX...
        </div>
      </div>
    ) : (
      /* Simple mode — friendly progress view */
      <SimpleProgressView
        activeStageIndex={activeStageIndex}
        totalStages={STAGE_ORDER.length}
        activeStageType={activeStageType}
      />
    )}
  </div>
```

**Important:** Do NOT remove the existing stages checklist JSX — wrap it inside the `devMode ? (...)` branch so power users can still access it.

- [ ] **Step 5: Verify** — open a project that is currently building. By default you should see the spinner + friendly label + progress bar. Click "Dev" in the header to reveal the full stage checklist. Clicking again hides it. Refresh the page — dev mode state persists.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/dashboard/[id]/page.tsx
git commit -m "feat(project): add simple/dev mode toggle for SDLC build view"
```

---

## Task 3: Share Token — Schema & Migration

Add a `shareToken` column to the `project` table. This is the single source of truth for the public preview URL.

**Files:**
- Modify: `packages/database/src/schema.ts`
- Auto-generate: `packages/database/drizzle/<timestamp>_add_share_token.sql`

**Interfaces:**
- Produces: `project.shareToken: text | null` — a short nanoid, unique, nullable (null = never shared / old projects)

- [ ] **Step 1: Add `shareToken` to the project schema** in `packages/database/src/schema.ts`. Add one line inside the `project` table definition, after `repoUrl` (around line 85):

```ts
shareToken: text("share_token").unique(),
```

- [ ] **Step 2: Generate the migration**

```bash
pnpm --filter @repo/database db:generate
```

Expected: a new file appears in `packages/database/drizzle/` with SQL like:
```sql
ALTER TABLE "project" ADD COLUMN "share_token" text;
ALTER TABLE "project" ADD CONSTRAINT "project_share_token_unique" UNIQUE("share_token");
```

- [ ] **Step 3: Run the migration against your local DB**

```bash
pnpm --filter @repo/database db:migrate
```

Expected output: `[✓] Migrations applied` (or similar — no errors)

- [ ] **Step 4: Commit schema + migration together**

```bash
git add packages/database/src/schema.ts packages/database/drizzle/
git commit -m "feat(db): add share_token column to project table"
```

---

## Task 4: Public Share Preview Endpoint (depends on Task 3)

A public `GET /api/share/:token/*` endpoint that serves a project's files without requiring authentication. The token is short (nanoid 10 chars), non-guessable, and maps to a single project in the DB.

**Files:**
- Modify: `apps/server/src/modules/agent/agent.controller.ts`
- Modify: `apps/server/src/app.ts` (or wherever routes are registered — check the existing route file)

**Interfaces:**
- Consumes: `project.shareToken` from Task 3
- Produces: `GET /api/share/:token/*` → serves file content (same logic as the existing `preview` handler but without `ownedProject` auth check)

- [ ] **Step 1: Check how routes are registered** — open `apps/server/src/app.ts` (or the router file) to understand the pattern for adding new routes:

```bash
# Quick look at the express router setup
cat apps/server/src/app.ts
```

- [ ] **Step 2: Add `sharePreview` handler** to `apps/server/src/modules/agent/agent.controller.ts`. Add this method to the `AgentController` object, after the existing `preview` handler (around line 259):

```ts
/** GET /api/share/:token/* — public unauthenticated preview for a shared project. */
async sharePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params as { token: string };

    // Look up the project by share token (no user ownership check — intentionally public)
    const rows = await db
      .select()
      .from(projectTable)
      .where(eq(projectTable.shareToken, token));
    if (!rows[0]) {
      res.status(404).type("text/plain").send("Preview not found.");
      return;
    }
    const projectId = rows[0].id;

    const rest = (req.params as Record<string, string>)["0"] ?? "";
    const path = rest === "" || rest.endsWith("/") ? `${rest}index.html` : rest;

    const fileStore = new DbFileStore(projectId);
    const files = await fileStore.list();

    if (files.length === 0) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.send(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;color:#171717"><h2>Preview not ready yet.</h2><p>Files are still being generated.</p></body></html>`);
      return;
    }

    const matchingFile = files.find((f) => f.path === path || f.path.endsWith(path));
    if (!matchingFile) {
      res.status(404).type("text/plain").send(`Not found: ${path}`);
      return;
    }
    res.setHeader("Content-Type", contentTypeFor(path));
    res.setHeader("Cache-Control", "no-store");
    res.send(matchingFile.content);
  } catch (err) {
    next(err);
  }
},
```

Also update the import at the top of `agent.controller.ts` to include `Request` from express (it already imports `Response, NextFunction` — add `Request`):
```ts
import { Request, Response, NextFunction } from "express";
```

- [ ] **Step 3: Register the new route** — in `apps/server/src/app.ts` (or wherever `/api/projects` routes are defined), add a new route for the public share endpoint **before** any auth middleware that would block it:

```ts
// Public — no auth middleware
app.get("/api/share/:token", AgentController.sharePreview);
app.get("/api/share/:token/*", AgentController.sharePreview);
```

- [ ] **Step 4: Populate `shareToken` on project creation** — in `apps/server/src/modules/projects/projects.controller.ts`, add nanoid import at the top:

```ts
import { nanoid } from "nanoid";
```

Then in the `create` handler, when inserting the project row, add the `shareToken`:

```ts
const shareToken = nanoid(10);
// In the db.insert(projectTable).values({...}) call, add:
shareToken,
```

- [ ] **Step 5: Test the endpoint manually** — create a new project (which will now get a token), then visit `http://localhost:5001/api/share/<token>/` in an incognito window (no cookies). You should see the preview or the "not ready yet" placeholder — not a 401.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/modules/agent/agent.controller.ts apps/server/src/app.ts apps/server/src/modules/projects/projects.controller.ts
git commit -m "feat(server): add public share preview endpoint /api/share/:token"
```

---

## Task 5: Share URL in UI (depends on Task 4)

Surface the share URL everywhere it matters: the completed project hero card, the agent workspace header, and the dashboard project cards.

**Files:**
- Modify: `apps/web/app/dashboard/_lib/projects.ts`
- Modify: `apps/web/app/dashboard/[id]/page.tsx`
- Modify: `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx`

**Interfaces:**
- Consumes: `project.shareToken: string | null` from the API (Task 4 populated it on new projects; old projects have `null`)
- Produces: `getShareUrl(token: string): string` helper; copy-to-clipboard button in the UI

- [ ] **Step 1: Add `shareToken` to the `Project` type** in `apps/web/app/dashboard/_lib/projects.ts`. Find the `Project` interface and add:

```ts
shareToken: string | null;
```

Also add a helper at the bottom of the file:

```ts
export function getShareUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
  return `${base}/preview/${token}`;
}
```

- [ ] **Step 2: Add a public share preview page** — create `apps/web/app/preview/[token]/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

export default function PublicPreviewPage() {
  const params = useParams();
  const token = params.token as string;
  const previewSrc = `${BACKEND_URL}/api/share/${token}/`;

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a]">
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
```

- [ ] **Step 3: Add "Copy share link" button to the completed view hero card** in `apps/web/app/dashboard/[id]/page.tsx`. Find the completed view hero `<div className="flex gap-2">` around line 570. Add a copy button after the existing "Open site →" button:

```tsx
{project.shareToken && (
  <CopyShareButton token={project.shareToken} />
)}
```

Then define `CopyShareButton` as a small inline component above `ProjectDetailPage`:

```tsx
function CopyShareButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"}/preview/${token}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="cs-btn cs-btn-sm cs-btn-outline border-[var(--ink-700)] text-white hover:bg-[var(--ink-800)] gap-1.5"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Share link
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Add share URL to the agent workspace header** in `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx`. Update the component props to accept `shareToken`:

```tsx
export default function AgentWorkspace({
  projectId,
  projectTitle,
  modelId,
  shareToken,
}: {
  projectId: string;
  projectTitle: string;
  modelId?: string;
  shareToken?: string | null;
}) {
```

In the preview pane header (`<div className="flex items-center gap-3">` area), add after the "Open in new tab" link:

```tsx
{shareToken && (
  <AgentShareButton token={shareToken} />
)}
```

Define `AgentShareButton` at the top of the file (outside the component):

```tsx
function AgentShareButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000"}/preview/${token}`;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
    >
      {copied ? "Copied ✓" : "Share ↗"}
    </button>
  );
}
```

Update the call site in `[id]/page.tsx` that renders `<AgentWorkspace>` to pass `shareToken`:
```tsx
<AgentWorkspace
  projectId={project.id}
  projectTitle={project.title}
  shareToken={project.shareToken}
/>
```

- [ ] **Step 5: Verify** — create a project, wait for it to complete. The hero card should show a "Share link" button. Clicking it copies a URL to clipboard. Opening that URL in an incognito window shows the public preview page with a "Built with CodeSetu" bar.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/dashboard/_lib/projects.ts apps/web/app/dashboard/[id]/page.tsx apps/web/app/dashboard/[id]/_components/agent-workspace.tsx apps/web/app/preview/
git commit -m "feat(ui): surface share URL in project hero and agent workspace"
```

---

## Task 6: Quick-Action Chips in Agent Workspace (frontend only, no deps)

After a project is built, users stare at a blank chat input and don't know what to say. Quick-action chips give them one-click starting points.

**Files:**
- Modify: `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx`

**Interfaces:**
- Produces: clicking a chip calls `send(chip.text)` — same as typing and hitting Send

- [ ] **Step 1: Add the chips data** inside `AgentWorkspace`, just after the state declarations:

```tsx
const QUICK_ACTIONS = [
  "Make it mobile-friendly",
  "Add a dark mode toggle",
  "Add a contact form",
  "Make the colors bolder",
  "Add smooth scroll animations",
  "Add a footer with links",
];
```

- [ ] **Step 2: Show chips only when the conversation is empty** — in the message window section, just before the `<div ref={chatEndRef} />` line, add:

```tsx
{turns.length === 0 && !busy && (
  <div className="px-1">
    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2.5">
      Try asking…
    </p>
    <div className="flex flex-wrap gap-1.5">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action}
          type="button"
          onClick={() => void send(action)}
          className="press cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          {action}
        </button>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 3: Verify** — open a project with no chat history. You should see "Try asking…" with 6 chips. Clicking one sends the message and the chips disappear. On a project with existing chat turns, no chips are shown.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/[id]/_components/agent-workspace.tsx
git commit -m "feat(agent): add quick-action chips for first-time users"
```

---

## Self-Review

### Spec Coverage

| Feature | Tasks |
|---------|-------|
| Template gallery | Task 1 ✓ |
| SDLC abstraction (simple/dev mode) | Task 2 ✓ |
| Share token DB column | Task 3 ✓ |
| Public share endpoint | Task 4 ✓ |
| Share URL surfaced in UI | Task 5 ✓ |
| Quick-action iteration chips | Task 6 ✓ |

**Not in this plan (Phase 2):**
- GitHub export (requires OAuth app + GitHub API)
- Custom domain / Vercel deploy button (complex; deploymentUrl already in schema for pipeline path)
- Publish to Vercel from agent workspace (agent-built projects have no Vercel deploy yet)

### Dependency Order
Tasks 1, 2, 6 are fully independent — parallelizable.
Task 3 must precede Task 4 (migration before endpoint).
Task 4 must precede Task 5 (endpoint before UI surfaces URL).

### Placeholder Check
- No TBD or TODO — all code is written out
- `...existing JSX...` in Task 2 Step 4 — this is an instruction to preserve existing code, not a placeholder

### Type Consistency
- `shareToken: string | null` used in `Project` type, component prop, and DB schema — consistent
- `getShareUrl(token: string)` defined in Task 5 Step 1, consumed in same step — consistent
- `AgentWorkspace` prop `shareToken?: string | null` matches call site in Task 5 Step 4 — consistent
