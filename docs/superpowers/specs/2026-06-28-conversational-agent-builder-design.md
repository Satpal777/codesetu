# CodeSetu — Conversational Agent Builder (Phase 1 Design)

**Date:** 2026-06-28
**Status:** Design — pending implementation plan
**Replaces:** The fixed 10-stage "ShipFlow" pipeline as the active build experience.

---

## 1. Why we're doing this

### The problem with today's flow
CodeSetu currently drives every project through a rigid, one-pass pipeline:

`request → product_thinking → prd → design → tasks → implementation → review → fixes → approval → release`

This is the source of the dissatisfaction:

1. **Questions are asked blind.** The `request` stage generates 2–4 multiple-choice questions from *only* the raw idea string, before any thinking has happened — so they are generic and feel "dumb."
2. **It's a one-way conveyor belt.** Each stage runs exactly once. The AI cannot look at what it built, notice it's wrong, and try again.
3. **The "fix" stage is fake.** `review` finds problems; `fixes` only writes a *summary* of what "should be applied" — it never edits the code.
4. **The output is a single static HTML file**, not a real website.
5. **Generation is single-shot.** `@repo/ai` only exposes `generateStructured` / `generateProse` — no tool-calling, no agent loop.

The architecture is the problem, not the prompts.

### The product thesis (what makes this worth paying for)
The success bar is **not** a demo. It is: *a non-technical person describes an idea in plain words, watches a real website get built, and refines it by talking to it — then ships something they would actually pay to keep.*

- A client pays when the output is a **real, deployable website that solves a business need**, not a throwaway HTML toy.
- Therefore the value ladder must *reach* full-stack + deploy (Phases 3–4). That is what closes the sale.
- Phase 1's job is the **wedge**: make the conversational build experience itself feel magical and genuinely useful, with a quality bar of "a real, multi-section site I'd put my name on."

---

## 2. Direction (decided)

- **Experience:** Conversational agent builder (chat + live preview), like v0 / Lovable / Bolt — an agentic loop underneath. The rigid wizard is retired.
- **End-goal output:** Full-stack app (frontend + backend + data/auth/storage).
- **Backend provider:** InsForge (SDK + CLI already available; managed backend means we don't sandbox the backend ourselves).
- **Agent framework:** Vercel AI SDK (already in the stack). **No LangChain.**
- **Sandbox:** None in Phase 1. Adopt lazily (E2B as default pick) only when a real frontend *build* is needed. InsForge removes the backend-sandbox burden entirely.

---

## 3. Phase decomposition

A full-stack conversational builder is too large for one spec. Build in four independently-shippable phases:

| Phase | Delivers | Removes which pain |
|-------|----------|--------------------|
| **1. Agent core + live frontend loop** | Chat-driven agent, real file tree, tool-calling loop, smart in-context questions, multi-file frontend, live iframe preview, iterate-by-talking, streaming | Dumb questions · one-way conveyor · no iteration · single-file output |
| **2. Self-correcting loop** | Agent verifies its own output, sees errors, fixes them in a loop (real fixes) | Fake review→fix |
| **3. InsForge full-stack** | Agent provisions an InsForge backend, designs schema, wires auth/storage/data into the app | "Not a production website" |
| **4. Deploy** | One-click deploy of the full-stack app + share/publish | The payable outcome |

**This spec covers Phase 1 only.** It is the leanest viable core loop. Phases 2–4 layer on without rework.

---

## 4. Phase 1 scope (decided: leanest core loop)

**In scope:**
- Chat-driven tool-calling agent loop (`write_file`, `edit_file`, `read_file`, `list_files`, `delete_file`, `update_plan`, `ask_user`).
- Smart in-context questions via `ask_user` + a per-turn question budget (the fix for "dumb questions").
- A visible, agent-maintained plan/checklist.
- Live iframe preview served from the project file tree.
- Real-time streaming of assistant text and file changes to the UI.
- Multi-file static frontend (HTML/CSS/vanilla JS) — the realistic, polished kind, not a sketch.

**Deferred (YAGNI for Phase 1):** checkpoints/undo, starter templates, repo-map summarization, sandbox infra, InsForge backend wiring, deploy, self-correcting verification loop.

---

## 5. Architecture

### 5.1 Where things run
- **Agent loop → `apps/server`** (new `modules/agent`). Long-lived Express Node server, so a multi-step build cannot hit a serverless timeout. Exposed as a streaming endpoint.
- **Chat UI → `apps/web`** — a new project workspace that consumes the stream.
- **AI → `@repo/ai`**, extended with one agent-loop driver. Build agent runs on **Claude** (Opus default; Haiku for cheap classification/intent).
- **Inngest stays installed** but is **not** on the interactive Phase 1 path. It is reserved for durable background jobs (provisioning, deploy) in later phases.

### 5.2 The agent loop
A single driver built on the Vercel AI SDK:

```
streamText({
  model,                       // injectable — tests pass a stub model
  system,                      // assumptions-first prompt + question budget
  messages,                    // full conversation history
  tools,                       // the tool set below
  stopWhen: stepCountIs(MAX_STEPS),
})
```

The driver streams text deltas and tool-call events to the client over SSE. A turn ends when the model stops naturally, calls `ask_user`, or hits `MAX_STEPS`.

### 5.3 Tool set
All tools operate on a `ProjectFS` seam (data access over the `file` table). They never touch the DB directly.

| Tool | Purpose |
|------|---------|
| `list_files()` | Return the file tree (repo map) so the agent knows what exists without dumping every file into context. |
| `read_file(path)` | Read one file on demand. |
| `write_file(path, content)` | Create or overwrite a file. |
| `edit_file(path, old, new)` | **Targeted search-replace edit** — not a full rewrite. Fast, cheap, non-destructive. |
| `delete_file(path)` | Remove a file. |
| `update_plan(items)` | Set/replace the visible to-do checklist the user sees. |
| `ask_user(question, options[], multiSelect?)` | End the turn with one sharp question, rendered as tappable chips. |

### 5.4 Guardrails (mandatory from day one)
- `MAX_STEPS` cap per turn.
- Token budget per turn.
- Tool errors are **returned to the model as tool results** (so it self-corrects) rather than thrown.
- On budget exhaustion: end the turn gracefully with a "paused — here's where I am" assistant message, never a crash.
- Per-turn **question budget** (default: at most 1 `ask_user`).

### 5.5 The "dumb questions" fix (concrete)
- **No upfront `request` stage.** The agent starts building from the idea immediately.
- System prompt directive: *"Make reasonable assumptions. Ask at most ONE question, only when genuinely blocked, and never ask what you can infer from the idea or the files."*
- `ask_user` surfaces a single, context-derived question with concrete options rendered as chips (reusing the existing chip styling from `ClarificationsForm`). Tapping a chip becomes the next user message. The user can also type freely at any time.

---

## 6. Data model (Drizzle — new tables)

### `message`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text (uuid) | PK |
| `projectId` | text | FK → project |
| `role` | text | `user` \| `assistant` \| `system` |
| `content` | text | Plain text content |
| `parts` | jsonb | Tool calls/results, plan snapshots, question payloads |
| `createdAt` | timestamp | |

### `file`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text (uuid) | PK |
| `projectId` | text | FK → project |
| `path` | text | Unique per project: `(projectId, path)` |
| `content` | text | File contents |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

- Existing `project` table is kept (add a `mode`/`status` field if needed to route new projects to the agent flow).
- Legacy `stage` / `clarification` / `artifact` tables are **left in place but off the new path**. They are removed in a later cleanup, not in Phase 1.

---

## 7. Live preview

- **`GET /api/projects/:id/preview/*`** in `apps/server` serves files directly from the `file` table with correct `Content-Type` (resolving `index.html` at the root).
- The workspace iframe `src` points at `.../preview/`.
- Served behind a **`Runtime` interface** (`getPreviewUrl(projectId)` / file-serving). Phase 1 implements it with the iframe-route. Swapping in E2B / Daytona / Vercel Sandbox later is a single adapter — not a rewrite.

---

## 8. UX — the workspace

Replaces the staged project page (`apps/web/app/dashboard/[id]/page.tsx`).

- **Left pane — chat thread:** streaming assistant text, the live plan checklist, file-change pills (e.g. "✎ edited `styles.css`"), `ask_user` question chips, and the message composer.
- **Right pane — live result:** the iframe preview (adapted `PreviewPanel`) plus a simple file list.
- Files appear and update live as the agent works — the "magic" moment.

**Kept / lightly adapted:** AI registry/catalog/resolver, Drizzle/better-auth, dashboard shell, `PreviewPanel`, the landing pipeline animation (marketing — a deliberate exception).
**Replaced on the active path:** `pipeline.ts`, `pipeline.stages.ts`, the clarification flow, `AssemblyPanel`'s stage logic, the staged project page.

---

## 9. Data flow (one turn)

1. User sends a message (or taps a question chip → becomes a user message).
2. Chat endpoint persists it, loads conversation history + the file tree, and starts `streamText` with tools + the system prompt.
3. The agent streams reasoning/text and calls tools; each tool mutates `ProjectFS` and emits an event to the client.
4. The loop continues until the agent stops, calls `ask_user`, or hits the step budget.
5. The assistant message + parts are persisted; the client refreshes the iframe preview.

---

## 10. Error handling

- **Tool errors** → returned to the model as tool results so it can self-correct.
- **Loop exhaustion** (`MAX_STEPS` / token budget) → graceful "paused" turn end.
- **Model/provider errors** → caught in the streaming endpoint and emitted as an `error` event the UI renders.
- **Invalid paths / oversized content** → validated and rejected inside `ProjectFS`.

---

## 11. Testing

- **Unit:**
  - `ProjectFS` — CRUD, `edit_file` search-replace application, path validation, uniqueness.
  - Each tool handler against a mock FS.
  - The question-budget guard.
- **Integration:**
  - A **stub model** that emits a scripted sequence of tool calls → assert the resulting file tree, the persisted messages, and that the preview route serves the files.
  - The loop driver takes an **injectable model**, so tests require no real API calls.

---

## 12. Out of scope for Phase 1 (revisited)

Checkpoints/undo · starter templates · repo-map summarization · sandbox infra (E2B/Daytona) · InsForge backend wiring · deploy/publish · self-correcting verification loop. Each is a clean, additive later phase.
