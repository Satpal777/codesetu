# Delete Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a delete action that permanently removes a project's DB records, files, messages, and Daytona sandbox from both the dashboard list and the project detail page header.

**Architecture:** Hard delete — all DB child rows are deleted in FK order inside a single Drizzle transaction, the API responds 200, then a fire-and-forget promise destroys the Daytona sandbox. The UI shows a type-to-confirm modal (shared component) from both entry points; on success it updates the React Query cache and, on the detail page, redirects to `/dashboard`.

**Tech Stack:** Express + Drizzle ORM (server), Next.js 14 App Router + TanStack Query v5 + motion/react (web), Daytona SDK `@daytona/sdk@0.192.0`

## Global Constraints

- Auth guard on all server routes — ownership check via `req.user.id === project.userId`
- Delete order: `artifact` → `clarification` → `message` → `file` → `stage` → `project` (FK order)
- Daytona cleanup: `daytona.get(projectId)` then `daytona.delete(sandbox)` — both wrapped in try/catch, errors logged not re-thrown
- No schema migration — all tables already exist
- UI styled with existing `cs-btn` classes and CSS custom properties (`var(--bg-raised)`, etc.)
- Confirm input must match `project.title` exactly (case-sensitive) to enable Delete button

---

## File Map

| File | Change |
|---|---|
| `apps/server/src/modules/projects/projects.controller.ts` | Add `delete` method; import `message`, `file` tables |
| `apps/server/src/modules/projects/projects.routes.ts` | Add `router.delete("/:id", ...)` |
| `apps/server/src/modules/agent/runtime.ts` | Export `destroySandbox(projectId)` helper |
| `apps/web/app/dashboard/_lib/projects.ts` | Add `deleteProject(id)` API function |
| `apps/web/app/dashboard/_components/delete-project-modal.tsx` | **Create** — shared type-to-confirm modal |
| `apps/web/app/dashboard/page.tsx` | Add trash icon to history rows + recent cards, wire modal |
| `apps/web/app/dashboard/[id]/page.tsx` | Add Delete button to header, wire modal, redirect on delete |

---

## Task 1: Sandbox Destroy Helper + Backend DELETE Endpoint

**Files:**
- Modify: `apps/server/src/modules/agent/runtime.ts`
- Modify: `apps/server/src/modules/projects/projects.controller.ts`
- Modify: `apps/server/src/modules/projects/projects.routes.ts`

**Interfaces:**
- Produces:
  - `destroySandbox(projectId: string): Promise<void>` exported from `runtime.ts`
  - `DELETE /api/projects/:id` → `200 { status: "success", message: "Project deleted" }` or `404`

---

- [ ] **Step 1: Add `destroySandbox` export to `runtime.ts`**

Open `apps/server/src/modules/agent/runtime.ts`. At the bottom, after the `getRuntime` function, add:

```ts
/**
 * Destroys the Daytona sandbox named by projectId.
 * Errors are swallowed — sandbox may never have been created.
 */
export async function destroySandbox(projectId: string): Promise<void> {
  const daytona = new Daytona({
    apiKey: process.env.DAYTONA_API_KEY || "",
    apiUrl: process.env.DAYTONA_API_URL || "https://api.daytona.io",
    target: process.env.DAYTONA_TARGET || undefined,
  });
  try {
    const sandbox = await daytona.get(projectId);
    await daytona.delete(sandbox);
  } catch (err) {
    console.warn(`[destroySandbox] Could not delete sandbox for project ${projectId}:`, err);
  }
}
```

- [ ] **Step 2: Add `message` and `file` imports to the controller**

Open `apps/server/src/modules/projects/projects.controller.ts`. The current import from `@repo/database` is:

```ts
import {
  db,
  project as projectTable,
  stage as stageTable,
  artifact as artifactTable,
  clarification as clarificationTable,
  eq,
  and,
} from "@repo/database";
```

Replace it with:

```ts
import {
  db,
  project as projectTable,
  stage as stageTable,
  artifact as artifactTable,
  clarification as clarificationTable,
  message as messageTable,
  file as fileTable,
  eq,
  and,
} from "@repo/database";
```

- [ ] **Step 3: Add the `delete` method to `ProjectsController`**

At the bottom of the `ProjectsController` object in `projects.controller.ts`, before the closing `};`, add:

```ts
  /** DELETE /api/projects/:id — permanently remove project and all child data. */
  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };

      const rows = await db
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(and(eq(projectTable.id, id), eq(projectTable.userId, req.user.id)));
      if (!rows[0]) throw new AppError("Project not found", 404);

      await db.transaction(async (tx) => {
        await tx.delete(artifactTable).where(eq(artifactTable.projectId, id));
        await tx.delete(clarificationTable).where(eq(clarificationTable.projectId, id));
        await tx.delete(messageTable).where(eq(messageTable.projectId, id));
        await tx.delete(fileTable).where(eq(fileTable.projectId, id));
        await tx.delete(stageTable).where(eq(stageTable.projectId, id));
        await tx.delete(projectTable).where(eq(projectTable.id, id));
      });

      res.status(200).json({ status: "success", message: "Project deleted" });

      if (process.env.DAYTONA_API_KEY) {
        void import("../agent/runtime.js").then(({ destroySandbox }) => {
          void destroySandbox(id);
        });
      }
    } catch (err) {
      next(err);
    }
  },
```

- [ ] **Step 4: Register the DELETE route**

Open `apps/server/src/modules/projects/projects.routes.ts`. After the last route line, add:

```ts
router.delete("/:id", authGuard, ProjectsController.delete);
```

The full file should now look like:

```ts
import { Router } from "express";
import { ProjectsController } from "./projects.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

const router = Router();

router.post("/", authGuard, ProjectsController.create);
router.get("/", authGuard, ProjectsController.list);
router.get("/:id", authGuard, ProjectsController.get);
router.get("/:id/stream", authGuard, ProjectsController.stream);
router.get("/:id/clarifications", authGuard, ProjectsController.getClarifications);
router.post("/:id/clarifications", authGuard, ProjectsController.submitClarifications);
router.post("/:id/approve", authGuard, ProjectsController.approve);
router.post("/:id/deploy", authGuard, ProjectsController.deploy);
router.delete("/:id", authGuard, ProjectsController.delete);

export const projectsRouter = router;
```

- [ ] **Step 5: Verify the server compiles**

```bash
cd apps/server && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test of the endpoint**

Start the server (`pnpm dev` from repo root). With a valid session cookie, run:

```bash
curl -X DELETE http://localhost:5001/api/projects/<some-project-id> \
  -H "Cookie: <your-session-cookie>"
```

Expected: `{"status":"success","message":"Project deleted"}`  
Then re-fetching that project ID should return 404.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/agent/runtime.ts \
        apps/server/src/modules/projects/projects.controller.ts \
        apps/server/src/modules/projects/projects.routes.ts
git commit -m "feat(server): add DELETE /api/projects/:id with cascade cleanup and Daytona fire-and-forget"
```

---

## Task 2: Frontend API Client Function

**Files:**
- Modify: `apps/web/app/dashboard/_lib/projects.ts`

**Interfaces:**
- Produces: `deleteProject(id: string): Promise<void>`

---

- [ ] **Step 1: Add `deleteProject` to the projects API module**

Open `apps/web/app/dashboard/_lib/projects.ts`. After the `approveProject` function, add:

```ts
/** DELETE /api/projects/:id */
export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/projects/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `Couldn't delete project (${res.status}).`);
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/_lib/projects.ts
git commit -m "feat(web): add deleteProject API client function"
```

---

## Task 3: DeleteProjectModal Component

**Files:**
- Create: `apps/web/app/dashboard/_components/delete-project-modal.tsx`

**Interfaces:**
- Consumes: `deleteProject(id: string): Promise<void>` from `../_lib/projects`
- Consumes: `Project` type from `../_lib/projects`
- Produces:
  ```ts
  interface DeleteProjectModalProps {
    project: Project;
    onClose: () => void;
    onDeleted: () => void;
  }
  export default function DeleteProjectModal(props: DeleteProjectModalProps): JSX.Element
  ```

---

- [ ] **Step 1: Create the modal component**

Create `apps/web/app/dashboard/_components/delete-project-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { deleteProject, type Project } from "../_lib/projects";

interface DeleteProjectModalProps {
  project: Project;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteProjectModal({ project, onClose, onDeleted }: DeleteProjectModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: onDeleted,
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong."),
  });

  const canDelete = confirmText === project.title;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded border border-[var(--border-default)] bg-[var(--bg-raised)] p-6 shadow-xl">
        <h2 className="text-[16px] font-bold text-[var(--text-primary)] mb-1">Delete project?</h2>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5">
          This permanently deletes{" "}
          <strong className="text-[var(--text-primary)]">{project.title}</strong> and all its
          files, messages, and sandbox resources. This cannot be undone.
        </p>

        <label className="block text-[11px] font-mono uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
          Type project name to confirm
        </label>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && canDelete && !isPending) mutate(); }}
          placeholder={project.title}
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
            {isPending ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/dashboard/_components/delete-project-modal.tsx
git commit -m "feat(web): add DeleteProjectModal type-to-confirm component"
```

---

## Task 4: Dashboard Page Integration

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `DeleteProjectModal` from `./_components/delete-project-modal`
- Consumes: `Project` type from `./_lib/projects`

---

- [ ] **Step 1: Add modal state and import to `page.tsx`**

Open `apps/web/app/dashboard/page.tsx`. At the top, add the import:

```tsx
import DeleteProjectModal from "./_components/delete-project-modal";
```

Inside `DashboardPage`, add state below the existing `composerRef`:

```tsx
const [deletingProject, setDeletingProject] = useState<Project | null>(null);
```

Add a handler below that state:

```tsx
const handleProjectDeleted = (id: string) => {
  queryClient.setQueryData<Project[]>(["projects"], (prev) => prev?.filter((p) => p.id !== id) ?? []);
  setDeletingProject(null);
};
```

- [ ] **Step 2: Add trash icon to recent project cards**

Locate the `<Link>` element that wraps each recent project card (the one with `href={/dashboard/${p.id}}`). Wrap it in a `relative group` div and add a trash button inside:

Replace:
```tsx
<Link
  key={p.id}
  href={`/dashboard/${p.id}`}
  className="press block w-full rounded border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left shadow-sm hover:border-[var(--border-strong)]"
>
```

With:
```tsx
<div key={p.id} className="relative group">
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); setDeletingProject(p); }}
    title="Delete project"
    className="absolute top-2 right-2 z-10 hidden group-hover:flex h-6 w-6 items-center justify-center rounded border border-[var(--border-default)] bg-[var(--bg-raised)] text-[var(--text-tertiary)] hover:border-red-400 hover:text-red-600 transition-colors"
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  </button>
  <Link
    href={`/dashboard/${p.id}`}
    className="press block w-full rounded border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left shadow-sm hover:border-[var(--border-strong)]"
  >
```

And close the wrapper div after the `</Link>`:
```tsx
  </Link>
</div>
```

Note: remove `key={p.id}` from the `<Link>` since it now lives on the outer `<div>`.

- [ ] **Step 3: Add trash icon to history table rows**

Locate the history table header row with `grid-cols-[2fr_100px_120px_100px_1.5fr]`. Change it to `grid-cols-[2fr_100px_120px_100px_1.5fr_36px]` and add a blank column header:

```tsx
<div className="grid grid-cols-[2fr_100px_120px_100px_1.5fr_36px] gap-3 px-2.5 pb-2 border-b-2 border-[var(--border-strong)] text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
  <span>Project</span>
  <span>Status</span>
  <span>Stage</span>
  <span>Updated</span>
  <span>URL</span>
  <span />
</div>
```

Locate the history table data rows (the `<div className="grid grid-cols-[2fr_100px_120px_100px_1.5fr] ...">` inside `sortedProjects.map`). Change its grid to the same 6-column layout and add the trash button as the last cell:

```tsx
<div
  key={p.id}
  className="group grid grid-cols-[2fr_100px_120px_100px_1.5fr_36px] gap-3 px-2.5 py-3 items-center text-[13px] hover:bg-[var(--fill-muted)] transition-colors"
>
  {/* ... existing 5 cells unchanged ... */}
  <button
    type="button"
    onClick={() => setDeletingProject(p)}
    title="Delete project"
    className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded border border-transparent text-[var(--text-disabled)] hover:border-red-400 hover:text-red-600 transition-colors"
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  </button>
</div>
```

- [ ] **Step 4: Render the modal**

At the bottom of the `DashboardPage` return, just before the final closing `</div>`, add:

```tsx
{deletingProject && (
  <DeleteProjectModal
    project={deletingProject}
    onClose={() => setDeletingProject(null)}
    onDeleted={() => handleProjectDeleted(deletingProject.id)}
  />
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual test**

Visit `/dashboard`. Hover a history table row — trash icon should appear. Click it → modal opens with project title. Type wrong title → button stays disabled. Type exact title → button enables. Click "Delete project" → modal closes, project disappears from list.

Repeat for a recent project card.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/dashboard/page.tsx
git commit -m "feat(web): add delete action to dashboard project list and cards"
```

---

## Task 5: Project Detail Page Integration

**Files:**
- Modify: `apps/web/app/dashboard/[id]/page.tsx`

**Interfaces:**
- Consumes: `DeleteProjectModal` from `../_components/delete-project-modal`
- Consumes: `useRouter` from `next/navigation`

---

- [ ] **Step 1: Add imports to the detail page**

Open `apps/web/app/dashboard/[id]/page.tsx`. Add to the existing Next.js import line at the top:

```tsx
import { useRouter } from "next/navigation";
```

Add the modal import:

```tsx
import DeleteProjectModal from "../_components/delete-project-modal";
```

- [ ] **Step 2: Add modal state and handler inside `ProjectDetailPage`**

Below the existing `const queryClient = useQueryClient();` line, add:

```tsx
const router = useRouter();
const [showDeleteModal, setShowDeleteModal] = useState(false);
```

Add the delete handler below:

```tsx
const handleProjectDeleted = () => {
  queryClient.removeQueries({ queryKey: ["project", projectId] });
  queryClient.setQueryData(["projects"], (prev: Project[] | undefined) =>
    prev?.filter((p) => p.id !== projectId) ?? []
  );
  router.push("/dashboard");
};
```

- [ ] **Step 3: Add Delete button to the header bar**

Locate the header bar right-side `<div className="flex items-center gap-4">` that contains the Dev toggle, `ThemeToggle`, and the build badge. Add the Delete button as the first item:

```tsx
<div className="flex items-center gap-4">
  {showProject && (
    <button
      type="button"
      onClick={() => setShowDeleteModal(true)}
      title="Delete project"
      className="flex items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] hover:border-red-400 hover:text-red-600 transition-colors"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
      </svg>
      Delete
    </button>
  )}
  {/* ... existing Dev toggle, ThemeToggle, badge unchanged ... */}
</div>
```

- [ ] **Step 4: Render the modal**

At the very end of the `ProjectDetailPage` return, just before the final outer closing `</div>`, add:

```tsx
{showDeleteModal && project && (
  <DeleteProjectModal
    project={project}
    onClose={() => setShowDeleteModal(false)}
    onDeleted={handleProjectDeleted}
  />
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual test**

Visit `/dashboard/<project-id>`. The header should show a "Delete" label button (ghost, no border). Click → modal opens. Type project title → button enables. Confirm → modal closes, browser navigates to `/dashboard`, project no longer appears in list.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/dashboard/[id]/page.tsx
git commit -m "feat(web): add delete button to project detail page header"
```

---

## Self-Review

**Spec coverage:**
- ✅ `DELETE /api/projects/:id` endpoint with auth guard + ownership check
- ✅ FK-ordered transaction: artifact → clarification → message → file → stage → project
- ✅ Fire-and-forget Daytona sandbox destruction after response
- ✅ `destroySandbox` wraps `daytona.get` + `daytona.delete(sandbox)` with try/catch
- ✅ `deleteProject` API client function
- ✅ `DeleteProjectModal` with type-to-confirm (case-sensitive), spinner, inline error, Enter key
- ✅ Dashboard: trash icon on history rows + recent cards, cache update on delete
- ✅ Detail page: Delete button in header, cache invalidation + redirect on delete
- ✅ Daytona SDK API is `daytona.delete(sandbox)` — confirmed from `@daytona/sdk@0.192.0` types
- ✅ `message` and `file` tables exported from `@repo/database` via `export * from "./schema.js"`

**Placeholder scan:** No TBDs, no "implement later", all code blocks present and complete.

**Type consistency:**
- `deleteProject(id: string): Promise<void>` — used as-is in the modal's `mutationFn`
- `Project` type — imported consistently from `../_lib/projects` in all consumer files
- `destroySandbox(projectId: string): Promise<void>` — matches usage in controller
