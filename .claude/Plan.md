# ShipFlow AI — Pipeline Engine (Phase 2: post-auth)

## Context

`codesetu` is being built into **ShipFlow AI**, an AI-assisted product delivery platform that
moves a feature from a plain-language prompt to a production-ready application through a
structured pipeline:

> Request → Product Thinking → PRD → Tasks → Implementation → Review → Fixes → Approval → Release

Auth is done (Better Auth + Google OAuth, Drizzle adapter, Neon-ready Postgres). The repo is a
Turborepo monorepo: `apps/server` (Express), `apps/web` (Next.js 16), `packages/database`
(Drizzle), `packages/schemas` (Zod). No domain model, workflow engine, or AI layer exists yet.

**This milestone** wires the *entire 9-stage pipeline end-to-end but shallow*: every stage runs,
produces an artifact, and persists state, with minimal per-stage logic. Decisions locked in:
- **Implementation stage produces real code into a Git repo** (generate code → push branch → open PR).
- **AI provider: OpenAI** (OpenAI Node SDK — *not* Anthropic).
- **Workflow durability: Inngest.** **DB: Neon** (already configured via `DATABASE_URL`).

The goal is to establish the durable, human-in-the-loop pipeline pattern that all later depth
(sandboxed builds, test runners, richer prompts) plugs into.

---

## Architecture

```
User prompt ──POST /api/projects──▶ create project row ──emit "pipeline/start"──▶ Inngest
                                                                                    │
   Inngest fn "pipeline.run" runs stages sequentially via step.run():              ▼
   request → product-thinking → prd → tasks → implementation → review → fixes → approval → release
                     │                                              │                  │
            step.waitForEvent (clarifying Qs)            (real code: PR)     step.waitForEvent (approve)
```

- One durable Inngest function orchestrates all stages. Each stage = a `step.run()` that calls an
  OpenAI-backed handler, writes an `artifact`, and advances `project.currentStage`.
- Human-in-the-loop pauses use `step.waitForEvent`: after **Request** (clarifying questions) and
  before **Release** (**Approval**). The matching API endpoints emit the resume events.
- The AI layer is one handler per stage (prompt template → OpenAI call → structured output).

---

## Data model — `packages/database/src/schema.ts`

Add tables alongside the existing better-auth tables (reuse `text` PK + `timestamp` convention;
FK `userId`/`projectId` → `references(() => …)`). Use `pgEnum` for the controlled vocabularies.

- **`pgEnum stageType`**: `request`, `product_thinking`, `prd`, `tasks`, `implementation`,
  `review`, `fixes`, `approval`, `release`.
- **`pgEnum stageStatus`**: `pending`, `running`, `awaiting_input`, `completed`, `failed`.
- **`project`** — `id`, `userId` (FK user), `title`, `prompt` (original text), `status`,
  `currentStage` (stageType), `repoUrl`, `repoBranch`, timestamps.
- **`stage`** — `id`, `projectId` (FK), `type` (stageType), `status` (stageStatus), `order` (int),
  `error` (nullable), `startedAt`, `completedAt`.
- **`artifact`** — `id`, `projectId`, `stageId` (FK), `type` (stageType), `content` (`jsonb`),
  `version` (int), `createdAt`. The persisted output of each stage (PRD doc, task list, diff,
  review notes, PR url).
- **`clarification`** — `id`, `projectId`, `question` (text), `answer` (nullable text),
  `order`, `createdAt`. The post-Request questions and user answers.
- **`task`** — `id`, `projectId`, `title`, `description`, `status`, `order` — output of the Tasks stage.

Re-export is automatic (`packages/database/src/index.ts` does `export * from "./schema.js"`).
Migrate with the existing `db:push` script (see Verification).

---

## AI layer — `packages/ai` (new workspace package) or `apps/server/src/lib/ai`

Recommend a new `@repo/ai` package mirroring `@repo/schemas` (add to `pnpm-workspace.yaml` is
automatic via the `packages/*` glob; give it its own `package.json` + `tsconfig.json` extending
`@repo/typescript-config`).

- `client.ts` — instantiate the OpenAI SDK from `process.env.OPENAI_API_KEY`, export a configured
  model id constant (single place to swap models).
- `stages/<stageType>.ts` — one handler per stage: `(ctx) => Promise<Artifact content>`. Each takes
  the project prompt + prior artifacts and returns structured output (use OpenAI structured
  outputs / JSON schema so results are parseable). Shallow = one focused prompt per stage.
- `index.ts` — a `STAGE_HANDLERS: Record<stageType, handler>` map the Inngest function iterates.

---

## Workflow engine — Inngest

Install `inngest` in `apps/server`. New `apps/server/src/inngest/`:

- `client.ts` — `new Inngest({ id: "shipflow" })`.
- `functions/pipeline.ts` — `pipeline.run` triggered by event `pipeline/start` (`{ projectId }`).
  Walks the 9 stages in order; for each: mark stage `running`, `step.run(type, handler)`, write
  artifact, mark `completed`, set `project.currentStage`. Insert the two waits:
  - after `request`: generate clarifying questions, persist them, set stage `awaiting_input`, then
    `step.waitForEvent("clarifications/submitted", { match: "data.projectId" })`.
  - before `release`: set `awaiting_input`, `step.waitForEvent("approval/granted", …)`.
  - `implementation` step calls the real-code handler (below).
- Mount the serve handler: in `apps/server/src/app.ts`, add
  `app.use("/api/inngest", serve({ client, functions }))` **before** `app.use(errorHandler)`.

## Implementation stage (real code → repo)

In the AI layer's `implementation` handler (shallow path):
1. Read `project.repoUrl` / `repoBranch`; use **Octokit** (`@octokit/rest`) with a `GITHUB_TOKEN`.
2. Ask OpenAI to produce a small set of file changes (path + content) from the PRD + tasks artifacts.
3. Create a branch, commit the files via the GitHub contents API, open a PR.
4. Store the PR URL + changed paths as the `implementation` artifact.
Defer (future, out of scope here): sandboxed build/test execution, the Review stage actually
running CI, iterative Fixes loops. Keep Review/Fixes as AI-generated notes for now.

---

## API — `apps/server/src/modules/projects/` (mirror `modules/auth` pattern)

Reuse `authGuard`, `AppError`, the `{ status, data }` envelope, and Zod validation exactly as
`auth.controller.ts` does. Routes registered in `apps/server/src/routes/index.ts` under `/projects`.

- `POST /api/projects` — body `{ prompt, title?, repoUrl?, repoBranch? }`; create `project` +
  initial `stage` rows; `inngest.send({ name: "pipeline/start", data: { projectId } })`.
- `GET /api/projects` / `GET /api/projects/:id` — list / detail (project + stages + artifacts).
- `GET /api/projects/:id/clarifications` and
  `POST /api/projects/:id/clarifications` — save answers, then
  `inngest.send({ name: "clarifications/submitted", data: { projectId } })`.
- `POST /api/projects/:id/approve` — `inngest.send({ name: "approval/granted", data: { projectId } })`.

## Shared schemas — `packages/schemas/src/index.ts`

Add Zod schemas + inferred types for project create input, clarification-answer input, and the
response shapes (`ProjectResponseSchema`, `StageSchema`, `ArtifactSchema`), reusing the existing
`ApiResponseSchema` wrapper.

## Frontend — `apps/web/app/`

Shallow UI reusing the existing client-fetch-to-backend pattern:
- `projects/page.tsx` — list projects + a "new project" prompt box (POST then redirect).
- `projects/[id]/page.tsx` — render the 9-stage pipeline with per-stage status, show each
  artifact, a clarifying-questions form when `awaiting_input` on Request, and an Approve button
  when `awaiting_input` on Approval. Poll `GET /api/projects/:id` for live status.

## Config / env

Add to `apps/server/src/config/index.ts` (and the `required` array where appropriate) and to
`turbo.json` `globalEnv`: `OPENAI_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`,
`GITHUB_TOKEN`. Keep CORS/credentials handling as-is.

---

## Critical files

| Purpose | Path |
|---|---|
| Domain tables | `packages/database/src/schema.ts` |
| AI handlers (new pkg) | `packages/ai/src/{client,index}.ts`, `packages/ai/src/stages/*.ts` |
| Inngest client + fn | `apps/server/src/inngest/client.ts`, `…/functions/pipeline.ts` |
| Mount Inngest serve | `apps/server/src/app.ts` |
| Projects module | `apps/server/src/modules/projects/{projects.controller,projects.routes}.ts` |
| Route registration | `apps/server/src/routes/index.ts` |
| Shared schemas | `packages/schemas/src/index.ts` |
| Env/config | `apps/server/src/config/index.ts`, `turbo.json` |
| Frontend | `apps/web/app/projects/page.tsx`, `apps/web/app/projects/[id]/page.tsx` |

## Reuse (don't reinvent)

- Module shape: `apps/server/src/modules/auth/auth.controller.ts` + `auth.routes.ts` (authGuard,
  Zod parse, `AppError`, `{ status, data }` envelope).
- DB access + helpers: `db`, `eq`, table exports from `@repo/database`.
- Auth/session: `authGuard` from `apps/server/src/middleware/auth.middleware.ts` on every route.
- Response validation: `ApiResponseSchema` in `packages/schemas/src/index.ts`.

---

## Verification (end-to-end)

1. `pnpm install` (picks up `inngest`, `openai`, `@octokit/rest`, new `@repo/ai`).
2. Set env: `DATABASE_URL` (Neon), `OPENAI_API_KEY`, `GITHUB_TOKEN`, Inngest keys.
3. Migrate: `pnpm --filter @repo/database db:push` (Drizzle pushes new tables to Neon).
4. Start backend: `pnpm --filter server dev`; start Inngest dev server:
   `npx inngest-cli@latest dev` (auto-discovers `http://localhost:5001/api/inngest`).
5. `POST /api/projects` with a prompt → confirm a `project` row + `pipeline/start` event in the
   Inngest dev dashboard, and the function pausing at the clarifying-questions step
   (stage `awaiting_input`).
6. `POST /api/projects/:id/clarifications` → function resumes; watch stages advance through
   Product Thinking → PRD → Tasks → Implementation.
7. Implementation: confirm a branch + PR appear on the configured GitHub repo; PR URL stored as the
   `implementation` artifact.
8. `POST /api/projects/:id/approve` at the Approval pause → pipeline completes to Release;
   `project.status = completed`.
9. Frontend: load `/projects/[id]`, verify all 9 stages render with statuses and artifacts.

## Out of scope (next milestones)

Sandboxed build/test execution, CI-backed Review, iterative Fixes loops, GitHub App (vs PAT),
billing/multi-tenancy, and per-stage prompt depth/quality tuning.
