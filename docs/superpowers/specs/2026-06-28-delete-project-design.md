# Delete Project — Design Spec

**Date:** 2026-06-28  
**Branch:** feat/conversational-agent-builder  
**Status:** Approved for implementation

---

## Problem

Users have no way to remove projects. Over time the dashboard accumulates stale entries and allocated Daytona sandbox resources with no cleanup path.

## Goal

Add a "Delete project" action that permanently removes all traces of a project — DB records, generated files, agent messages, and the Daytona sandbox — with a safe type-to-confirm UX available from both the dashboard and the project detail page.

---

## Architecture

### Approach

Hard delete with best-effort sandbox destruction (Option C):

1. Delete all DB child rows in FK-safe order within a single transaction → respond 200
2. Fire-and-forget Daytona sandbox deletion after the response — errors swallowed and logged
3. If the project is mid-build, Inngest will 404 on the missing project and abort naturally — no special handling needed

### Why this order

- DB is the source of truth; clearing it immediately is what matters
- Daytona API latency must not block the HTTP response
- No schema migration required

---

## Backend

### New route

```
DELETE /api/projects/:id
```

Auth-guarded (`authGuard`), owner-scoped.

### Controller method: `ProjectsController.delete`

```
1. Fetch project where id + userId → 404 if not found
2. In a single Drizzle transaction, delete in FK order:
     artifact (FK → stage, project)
     clarification (FK → project)
     message (FK → project)
     file (FK → project)
     stage (FK → project)
     project
3. Send 200 { status: "success" }
4. After response (fire-and-forget):
     if DAYTONA_API_KEY set → daytona.delete(projectId), catch and log errors
```

### Files changed

- `apps/server/src/modules/projects/projects.controller.ts` — add `delete` method
- `apps/server/src/modules/projects/projects.routes.ts` — add `router.delete("/:id", authGuard, ...)`

---

## Frontend

### API client

Add to `apps/web/app/dashboard/_lib/projects.ts`:

```ts
deleteProject(id: string): Promise<void>
// DELETE /api/projects/:id
```

### Shared modal component

**File:** `apps/web/app/dashboard/_components/delete-project-modal.tsx`

**Props:**
```ts
{
  project: Project;
  onClose: () => void;
  onDeleted: () => void;   // called after successful delete
}
```

**UX:**
- Title: "Delete project?"
- Body: project title in bold, warning copy — "This permanently deletes all files, messages, and sandbox resources. This cannot be undone."
- Text input: placeholder "Type project name to confirm"
- Delete button: disabled until input matches `project.title` exactly (case-sensitive)
- On submit: call `deleteProject(project.id)`, show spinner on button, call `onDeleted()` on success
- On error: inline error below the input, keep modal open
- Cancel button always available

### Entry point 1 — Dashboard history table

**File:** `apps/web/app/dashboard/page.tsx`

- Add a trash icon `<button>` as the last column in each history table row (visible on row hover via `group-hover` or always visible)
- Clicking opens `DeleteProjectModal` for that project
- `onDeleted`: remove project from `["projects"]` React Query cache via `queryClient.setQueryData`, close modal

### Entry point 2 — Project detail page header

**File:** `apps/web/app/dashboard/[id]/page.tsx`

- Add a small "Delete" button in the header bar (right side, alongside the Dev toggle and ThemeToggle)
- Styled as a ghost/outline danger button (red tint on hover, matching existing `cs-btn` system)
- Clicking opens `DeleteProjectModal`
- `onDeleted`: remove project from `["projects"]` and `["project", id]` React Query caches, then `router.push("/dashboard")`

---

## Resource Cleanup Matrix

| Resource | Cleanup method | Timing |
|---|---|---|
| `artifact` rows | DB delete in transaction | Synchronous |
| `clarification` rows | DB delete in transaction | Synchronous |
| `message` rows | DB delete in transaction | Synchronous |
| `file` rows | DB delete in transaction | Synchronous |
| `stage` rows | DB delete in transaction | Synchronous |
| `project` row | DB delete in transaction | Synchronous |
| Daytona sandbox | `daytona.delete(projectId)` | Fire-and-forget post-response |
| Vercel deployment | Not deleted (live URL stays valid) | N/A — Vercel has no per-deployment delete in this setup |
| React Query cache | `queryClient.setQueryData` / `removeQueries` | Optimistic, client-side |
| In-flight Inngest run | Will 404 on next DB read and abort | Natural — no action needed |

---

## Error Handling

- Project not found or not owned by user → 404
- Daytona delete failure → log to console, do not surface to user (sandbox will be orphaned but DB is clean)
- API error during UI delete → show inline error in modal, keep modal open so user can retry

---

## Out of Scope

- Soft delete / undo
- Deleting the Vercel deployment (no per-deployment delete available via the current token setup)
- Bulk delete
- Admin delete of other users' projects
