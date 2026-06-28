# Conversational Agent Builder — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rigid 10-stage pipeline with a chat-driven, tool-calling agent that builds a multi-file static site, shows it in a live preview, and iterates by conversation.

**Architecture:** A loop driver (Vercel AI SDK `streamText` + tools) runs in `apps/server`. Tools mutate a project file tree through a `ProjectFS` seam over a `FileStore` (in-memory for tests, Drizzle in production). A streaming chat endpoint drives the loop and forwards events over SSE; a preview endpoint serves the file tree into an iframe. `apps/web` renders a two-pane workspace.

**Tech Stack:** TypeScript (ESM), Express, Vercel AI SDK v6 (`ai@^6`), Drizzle ORM (Postgres), Vitest, Next.js 16 (App Router), Claude (Anthropic).

## Global Constraints

- **ESM imports:** every relative import ends with `.js` (e.g. `./file-store.js`). Match existing files.
- **AI SDK v6 API:** tools are defined with `tool({ description, inputSchema, execute })` — the key is `inputSchema` (NOT `parameters`). Loop control uses `streamText`, `stepCountIs`, `hasToolCall` imported from `ai`.
- **IDs / time:** primary keys are `text` UUID strings via `randomUUID()` from `node:crypto`; timestamps are JS `Date`.
- **API response shape:** `{ status: "success" | "error", message?: string, data?: {...} }` — match existing controllers.
- **Auth:** all new routes sit behind `authGuard`; every controller method checks `req.user` and 401s if missing, and scopes every project query by `userId`.
- **Build agent model:** resolved via `resolveModel(modelId)` from `@repo/ai`; default `DEFAULT_MODEL_ID` (`anthropic|claude-opus-4-8`). Free/OpenRouter models are NOT used for the build loop (no tool-calling).
- **Loop guardrails:** `MAX_STEPS = 16` per turn; `maxOutputTokens` set on `streamText`; tool errors are returned as string results, never thrown; `ask_user` is a terminal tool (turn ends when it's called).
- **Path safety:** file paths are relative, POSIX, no `..`, no leading `/`, no backslashes.

---

## File Structure

**Create:**
- `apps/server/vitest.config.ts` — test runner config.
- `apps/server/src/modules/agent/file-store.ts` — `FileStore` interface + `InMemoryFileStore`.
- `apps/server/src/modules/agent/file-store.test.ts`
- `apps/server/src/modules/agent/project-fs.ts` — `ProjectFS` (path validation, `editFile` search-replace).
- `apps/server/src/modules/agent/project-fs.test.ts`
- `apps/server/src/modules/agent/tools.ts` — `createTools(fs, onEvent)` AI SDK tool set.
- `apps/server/src/modules/agent/tools.test.ts`
- `apps/server/src/modules/agent/system-prompt.ts` — assumptions-first system prompt.
- `apps/server/src/modules/agent/agent-loop.ts` — `runAgentTurn(...)` loop driver.
- `apps/server/src/modules/agent/agent-loop.test.ts`
- `apps/server/src/modules/agent/db-file-store.ts` — Drizzle `FileStore`.
- `apps/server/src/modules/agent/message-store.ts` — load/append chat messages.
- `apps/server/src/modules/agent/runtime.ts` — `Runtime` preview seam + content-type helper.
- `apps/server/src/modules/agent/agent.controller.ts` — chat (SSE), preview, messages.
- `apps/server/src/modules/agent/agent.routes.ts` — routes (mergeParams).
- `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx` — two-pane chat + preview UI.

**Modify:**
- `packages/database/src/schema.ts` — add `message` + `file` tables.
- `packages/ai/src/index.ts` — export `resolveModel`.
- `packages/schemas/src/index.ts` — add `AgentChatInputSchema`.
- `apps/server/package.json` — add `ai`, `vitest` deps + `test` script.
- `apps/server/src/routes/index.ts` — mount `agentRouter`.
- `apps/web/app/dashboard/[id]/page.tsx` — render `AgentWorkspace` for agent-mode projects.

---

## Task 1: Database schema — `message` and `file` tables

**Files:**
- Modify: `packages/database/src/schema.ts` (append after the `clarification` table, end of file)

**Interfaces:**
- Produces: Drizzle tables `message` and `file`, exported from `@repo/database` (re-exported via `export * from "./schema.js"`).
  - `file` columns: `id, projectId, path, content, createdAt, updatedAt`.
  - `message` columns: `id, projectId, role, content, parts, createdAt`.

- [ ] **Step 1: Add the tables**

Append to `packages/database/src/schema.ts`:

```ts
// ── Agent builder domain (Phase 1) ──────────────────────────────────────────

export const message = pgTable("message", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => project.id),
  // "user" | "assistant" | "system"
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  // Tool calls/results, plan snapshots, and question payloads for this turn.
  parts: jsonb("parts").$type<unknown[]>(),
  createdAt: timestamp("created_at").notNull(),
});

export const file = pgTable(
  "file",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => project.id),
    // POSIX-relative path, unique per project (e.g. "index.html", "styles.css").
    path: text("path").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (t) => ({
    projectPathUnique: uniqueIndex("file_project_path_unique").on(t.projectId, t.path),
  }),
);
```

- [ ] **Step 2: Add the `uniqueIndex` import**

In `packages/database/src/schema.ts` line 1, add `uniqueIndex` to the import:

```ts
import { pgTable, text, timestamp, boolean, integer, jsonb, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @repo/database db:generate`
Expected: a new SQL file appears under `packages/database/drizzle/` (or configured `out`) containing `CREATE TABLE "message"` and `CREATE TABLE "file"` plus `file_project_path_unique`.

- [ ] **Step 4: Verify the generated SQL**

Open the newest generated `.sql` file and confirm it contains `CREATE TABLE "file"`, `CREATE TABLE "message"`, and `CREATE UNIQUE INDEX "file_project_path_unique"`. (Applying it via `db:migrate` requires a live `DATABASE_URL`; do that during Task 7 manual verification.)

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema.ts packages/database/drizzle
git commit -m "feat(db): add message and file tables for agent builder"
```

---

## Task 2: Vitest setup + `FileStore` + `InMemoryFileStore`

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/src/modules/agent/file-store.ts`
- Test: `apps/server/src/modules/agent/file-store.test.ts`

**Interfaces:**
- Produces:
  - `interface StoredFile { path: string; content: string }`
  - `interface FileStore { list(): Promise<StoredFile[]>; get(path: string): Promise<string | null>; put(path: string, content: string): Promise<void>; remove(path: string): Promise<boolean> }`
  - `class InMemoryFileStore implements FileStore` — constructable with no args.

- [ ] **Step 1: Add deps + test script to `apps/server/package.json`**

In `dependencies` add (alongside the existing ones):

```json
"ai": "^6.0.209",
```

In `devDependencies` add:

```json
"vitest": "^2.1.8",
```

In `scripts` add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Then run: `pnpm install`
Expected: completes; `vitest` is available.

- [ ] **Step 2: Create `apps/server/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Write the failing test** — `apps/server/src/modules/agent/file-store.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { InMemoryFileStore } from "./file-store.js";

describe("InMemoryFileStore", () => {
  it("puts and gets a file", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("index.html", "<h1>Hi</h1>");
    expect(await fs.get("index.html")).toBe("<h1>Hi</h1>");
  });

  it("returns null for a missing file", async () => {
    const fs = new InMemoryFileStore();
    expect(await fs.get("nope.css")).toBeNull();
  });

  it("overwrites on a second put", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("a.txt", "one");
    await fs.put("a.txt", "two");
    expect(await fs.get("a.txt")).toBe("two");
  });

  it("lists files sorted by path", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("b.css", "b");
    await fs.put("a.html", "a");
    expect((await fs.list()).map((f) => f.path)).toEqual(["a.html", "b.css"]);
  });

  it("removes a file and reports whether it existed", async () => {
    const fs = new InMemoryFileStore();
    await fs.put("x.js", "x");
    expect(await fs.remove("x.js")).toBe(true);
    expect(await fs.remove("x.js")).toBe(false);
    expect(await fs.get("x.js")).toBeNull();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter server test -- file-store`
Expected: FAIL — cannot find module `./file-store.js`.

- [ ] **Step 5: Implement** — `apps/server/src/modules/agent/file-store.ts`

```ts
export interface StoredFile {
  path: string;
  content: string;
}

/** Minimal storage contract the agent's file tools depend on. */
export interface FileStore {
  list(): Promise<StoredFile[]>;
  get(path: string): Promise<string | null>;
  put(path: string, content: string): Promise<void>;
  remove(path: string): Promise<boolean>;
}

/** In-memory FileStore for tests and ephemeral use. */
export class InMemoryFileStore implements FileStore {
  private files = new Map<string, string>();

  async list(): Promise<StoredFile[]> {
    return [...this.files.entries()]
      .map(([path, content]) => ({ path, content }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async get(path: string): Promise<string | null> {
    return this.files.has(path) ? this.files.get(path)! : null;
  }

  async put(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async remove(path: string): Promise<boolean> {
    return this.files.delete(path);
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter server test -- file-store`
Expected: PASS (5 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/server/package.json apps/server/vitest.config.ts apps/server/src/modules/agent/file-store.ts apps/server/src/modules/agent/file-store.test.ts pnpm-lock.yaml
git commit -m "feat(agent): add FileStore seam + InMemoryFileStore + vitest"
```

---

## Task 3: `ProjectFS` — path validation + `editFile`

**Files:**
- Create: `apps/server/src/modules/agent/project-fs.ts`
- Test: `apps/server/src/modules/agent/project-fs.test.ts`

**Interfaces:**
- Consumes: `FileStore`, `StoredFile` from `./file-store.js`.
- Produces: `class ProjectFS` constructed as `new ProjectFS(store: FileStore)` with methods:
  - `listFiles(): Promise<StoredFile[]>`
  - `readFile(path: string): Promise<string>` — throws `FileError` if missing.
  - `writeFile(path: string, content: string): Promise<void>` — validates path.
  - `editFile(path: string, oldStr: string, newStr: string): Promise<void>` — replaces the first exact occurrence of `oldStr`; throws `FileError` if file missing or `oldStr` not found / not unique.
  - `deleteFile(path: string): Promise<void>` — throws `FileError` if missing.
  - `class FileError extends Error` (exported).

- [ ] **Step 1: Write the failing test** — `apps/server/src/modules/agent/project-fs.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { InMemoryFileStore } from "./file-store.js";
import { ProjectFS, FileError } from "./project-fs.js";

function fs() {
  return new ProjectFS(new InMemoryFileStore());
}

describe("ProjectFS path validation", () => {
  it("rejects absolute paths", async () => {
    await expect(fs().writeFile("/etc/passwd", "x")).rejects.toBeInstanceOf(FileError);
  });
  it("rejects parent traversal", async () => {
    await expect(fs().writeFile("../secrets.txt", "x")).rejects.toBeInstanceOf(FileError);
  });
  it("rejects backslashes", async () => {
    await expect(fs().writeFile("a\\b.txt", "x")).rejects.toBeInstanceOf(FileError);
  });
  it("accepts a normal nested path", async () => {
    const f = fs();
    await f.writeFile("css/styles.css", "body{}");
    expect(await f.readFile("css/styles.css")).toBe("body{}");
  });
});

describe("ProjectFS editFile", () => {
  it("replaces the first exact occurrence", async () => {
    const f = fs();
    await f.writeFile("index.html", "<h1>Old</h1>");
    await f.editFile("index.html", "Old", "New");
    expect(await f.readFile("index.html")).toBe("<h1>New</h1>");
  });
  it("throws when the file is missing", async () => {
    await expect(fs().editFile("nope.html", "a", "b")).rejects.toBeInstanceOf(FileError);
  });
  it("throws when oldStr is not found", async () => {
    const f = fs();
    await f.writeFile("a.txt", "hello");
    await expect(f.editFile("a.txt", "xyz", "b")).rejects.toBeInstanceOf(FileError);
  });
  it("throws when oldStr appears more than once (ambiguous)", async () => {
    const f = fs();
    await f.writeFile("a.txt", "x x");
    await expect(f.editFile("a.txt", "x", "y")).rejects.toBeInstanceOf(FileError);
  });
});

describe("ProjectFS readFile/deleteFile", () => {
  it("readFile throws on missing", async () => {
    await expect(fs().readFile("missing.txt")).rejects.toBeInstanceOf(FileError);
  });
  it("deleteFile removes an existing file", async () => {
    const f = fs();
    await f.writeFile("a.txt", "1");
    await f.deleteFile("a.txt");
    await expect(f.readFile("a.txt")).rejects.toBeInstanceOf(FileError);
  });
  it("deleteFile throws on missing", async () => {
    await expect(fs().deleteFile("missing.txt")).rejects.toBeInstanceOf(FileError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter server test -- project-fs`
Expected: FAIL — cannot find module `./project-fs.js`.

- [ ] **Step 3: Implement** — `apps/server/src/modules/agent/project-fs.ts`

```ts
import type { FileStore, StoredFile } from "./file-store.js";

export class FileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileError";
  }
}

/** Reject anything that isn't a safe, POSIX-relative project path. */
function assertSafePath(path: string): void {
  if (!path || path.trim() === "") throw new FileError("Path must not be empty.");
  if (path.includes("\\")) throw new FileError(`Path must use "/" not "\\": ${path}`);
  if (path.startsWith("/")) throw new FileError(`Path must be relative (no leading "/"): ${path}`);
  if (path.split("/").some((seg) => seg === "..")) {
    throw new FileError(`Path must not contain "..": ${path}`);
  }
}

export class ProjectFS {
  constructor(private readonly store: FileStore) {}

  listFiles(): Promise<StoredFile[]> {
    return this.store.list();
  }

  async readFile(path: string): Promise<string> {
    assertSafePath(path);
    const content = await this.store.get(path);
    if (content === null) throw new FileError(`File not found: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    assertSafePath(path);
    await this.store.put(path, content);
  }

  async editFile(path: string, oldStr: string, newStr: string): Promise<void> {
    assertSafePath(path);
    const content = await this.store.get(path);
    if (content === null) throw new FileError(`Cannot edit — file not found: ${path}`);
    const first = content.indexOf(oldStr);
    if (first === -1) {
      throw new FileError(`Text to replace was not found in ${path}.`);
    }
    if (content.indexOf(oldStr, first + oldStr.length) !== -1) {
      throw new FileError(
        `Text to replace appears more than once in ${path}; include more surrounding context to make it unique.`,
      );
    }
    await this.store.put(path, content.slice(0, first) + newStr + content.slice(first + oldStr.length));
  }

  async deleteFile(path: string): Promise<void> {
    assertSafePath(path);
    const existed = await this.store.remove(path);
    if (!existed) throw new FileError(`Cannot delete — file not found: ${path}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter server test -- project-fs`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/agent/project-fs.ts apps/server/src/modules/agent/project-fs.test.ts
git commit -m "feat(agent): add ProjectFS with path validation and editFile"
```

---

## Task 4: Agent tools — `createTools(fs, onEvent)`

**Files:**
- Create: `apps/server/src/modules/agent/tools.ts`
- Test: `apps/server/src/modules/agent/tools.test.ts`

**Interfaces:**
- Consumes: `ProjectFS` from `./project-fs.js`; `tool` from `ai`.
- Produces:
  - `type AgentEvent =`
    - `{ type: "plan"; items: string[] }`
    - `| { type: "file"; action: "write" | "edit" | "delete"; path: string }`
    - `| { type: "question"; question: string; options: string[]; multiSelect: boolean }`
    - `| { type: "text"; delta: string }`
    - `| { type: "error"; message: string }`
  - `function createTools(fs: ProjectFS, onEvent: (e: AgentEvent) => void): Record<string, Tool>` returning tools named `list_files`, `read_file`, `write_file`, `edit_file`, `delete_file`, `update_plan`, `ask_user`.

- [ ] **Step 1: Write the failing test** — `apps/server/src/modules/agent/tools.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { InMemoryFileStore } from "./file-store.js";
import { ProjectFS } from "./project-fs.js";
import { createTools, type AgentEvent } from "./tools.js";

function setup() {
  const fs = new ProjectFS(new InMemoryFileStore());
  const events: AgentEvent[] = [];
  const tools = createTools(fs, (e) => events.push(e));
  return { fs, events, tools };
}

// AI SDK tools expose `execute(input, options)`; tests call it directly.
const call = (tool: any, input: unknown) => tool.execute(input, { toolCallId: "t", messages: [] });

describe("createTools", () => {
  it("write_file creates a file and emits a file event", async () => {
    const { fs, events, tools } = setup();
    const out = await call(tools.write_file, { path: "index.html", content: "<h1>Hi</h1>" });
    expect(await fs.readFile("index.html")).toBe("<h1>Hi</h1>");
    expect(events).toContainEqual({ type: "file", action: "write", path: "index.html" });
    expect(typeof out).toBe("string");
  });

  it("list_files returns the current tree", async () => {
    const { fs, tools } = setup();
    await fs.writeFile("a.css", "x");
    const out = (await call(tools.list_files, {})) as string;
    expect(out).toContain("a.css");
  });

  it("edit_file applies a replacement", async () => {
    const { fs, events, tools } = setup();
    await fs.writeFile("a.txt", "red");
    await call(tools.edit_file, { path: "a.txt", old: "red", new: "blue" });
    expect(await fs.readFile("a.txt")).toBe("blue");
    expect(events).toContainEqual({ type: "file", action: "edit", path: "a.txt" });
  });

  it("returns a friendly error string instead of throwing", async () => {
    const { tools } = setup();
    const out = (await call(tools.edit_file, { path: "missing.txt", old: "a", new: "b" })) as string;
    expect(out.toLowerCase()).toContain("not found");
  });

  it("update_plan emits a plan event", async () => {
    const { events, tools } = setup();
    await call(tools.update_plan, { items: ["Build hero", "Add footer"] });
    expect(events).toContainEqual({ type: "plan", items: ["Build hero", "Add footer"] });
  });

  it("ask_user emits a question event", async () => {
    const { events, tools } = setup();
    await call(tools.ask_user, { question: "Which vibe?", options: ["Playful", "Serious"], multiSelect: false });
    expect(events).toContainEqual({
      type: "question",
      question: "Which vibe?",
      options: ["Playful", "Serious"],
      multiSelect: false,
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter server test -- tools`
Expected: FAIL — cannot find module `./tools.js`.

- [ ] **Step 3: Implement** — `apps/server/src/modules/agent/tools.ts`

```ts
import { tool, type Tool } from "ai";
import { z } from "zod";
import { ProjectFS, FileError } from "./project-fs.js";

export type AgentEvent =
  | { type: "plan"; items: string[] }
  | { type: "file"; action: "write" | "edit" | "delete"; path: string }
  | { type: "question"; question: string; options: string[]; multiSelect: boolean }
  | { type: "text"; delta: string }
  | { type: "error"; message: string };

/** Turn a thrown error into a short string the model can read and recover from. */
function asResult(err: unknown): string {
  if (err instanceof FileError) return `Error: ${err.message}`;
  return `Error: ${err instanceof Error ? err.message : String(err)}`;
}

export function createTools(fs: ProjectFS, onEvent: (e: AgentEvent) => void): Record<string, Tool> {
  return {
    list_files: tool({
      description: "List every file in the project with its path. Call this to see what already exists before editing.",
      inputSchema: z.object({}),
      execute: async () => {
        const files = await fs.listFiles();
        if (files.length === 0) return "The project is empty. Start by creating index.html.";
        return files.map((f) => `${f.path} (${f.content.length} bytes)`).join("\n");
      },
    }),

    read_file: tool({
      description: "Read the full contents of one file by its path.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        try {
          return await fs.readFile(path);
        } catch (err) {
          return asResult(err);
        }
      },
    }),

    write_file: tool({
      description:
        "Create a new file or completely overwrite an existing one. Use for new files or large rewrites. Prefer edit_file for small changes.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: async ({ path, content }) => {
        try {
          await fs.writeFile(path, content);
          onEvent({ type: "file", action: "write", path });
          return `Wrote ${path} (${content.length} bytes).`;
        } catch (err) {
          return asResult(err);
        }
      },
    }),

    edit_file: tool({
      description:
        "Replace one exact, unique snippet of text in a file. `old` must appear exactly once. Faster and safer than rewriting the whole file.",
      inputSchema: z.object({ path: z.string(), old: z.string(), new: z.string() }),
      execute: async ({ path, old, new: next }) => {
        try {
          await fs.editFile(path, old, next);
          onEvent({ type: "file", action: "edit", path });
          return `Edited ${path}.`;
        } catch (err) {
          return asResult(err);
        }
      },
    }),

    delete_file: tool({
      description: "Delete a file from the project by its path.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => {
        try {
          await fs.deleteFile(path);
          onEvent({ type: "file", action: "delete", path });
          return `Deleted ${path}.`;
        } catch (err) {
          return asResult(err);
        }
      },
    }),

    update_plan: tool({
      description:
        "Set the short, ordered to-do list shown to the user. Call whenever your plan changes so the user can follow along.",
      inputSchema: z.object({ items: z.array(z.string()).min(1).max(10) }),
      execute: async ({ items }) => {
        onEvent({ type: "plan", items });
        return "Plan updated.";
      },
    }),

    ask_user: tool({
      description:
        "Ask the user EXACTLY ONE question, only when you are genuinely blocked and cannot make a reasonable assumption. Provide 2–5 concrete options in plain language. This ends your turn.",
      inputSchema: z.object({
        question: z.string(),
        options: z.array(z.string()).min(2).max(5),
        multiSelect: z.boolean(),
      }),
      execute: async ({ question, options, multiSelect }) => {
        onEvent({ type: "question", question, options, multiSelect });
        return "Question sent to the user; waiting for their reply.";
      },
    }),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter server test -- tools`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/agent/tools.ts apps/server/src/modules/agent/tools.test.ts
git commit -m "feat(agent): add file/plan/ask_user tools with event emission"
```

---

## Task 5: System prompt + `runAgentTurn` loop driver

**Files:**
- Create: `apps/server/src/modules/agent/system-prompt.ts`
- Create: `apps/server/src/modules/agent/agent-loop.ts`
- Test: `apps/server/src/modules/agent/agent-loop.test.ts`
- Modify: `packages/ai/src/index.ts` (export `resolveModel`)

**Interfaces:**
- Consumes: `createTools`, `AgentEvent` from `./tools.js`; `ProjectFS` from `./project-fs.js`; `streamText, stepCountIs, hasToolCall, type ModelMessage, type LanguageModel` from `ai`.
- Produces:
  - `const SYSTEM_PROMPT: string` (from `system-prompt.ts`).
  - `MAX_STEPS = 16` (exported from `agent-loop.ts`).
  - `async function runAgentTurn(opts: { model: LanguageModel; messages: ModelMessage[]; fs: ProjectFS; onEvent: (e: AgentEvent) => void }): Promise<{ text: string }>`.

- [ ] **Step 1: Export `resolveModel` from `@repo/ai`**

In `packages/ai/src/index.ts`, add to the exports:

```ts
export { resolveModel } from "./registry.js";
```

- [ ] **Step 2: Create the system prompt** — `apps/server/src/modules/agent/system-prompt.ts`

```ts
export const SYSTEM_PROMPT = `You are CodeSetu, an expert web developer that builds real, polished websites for non-technical people by chatting with them.

You work by calling tools to read and write files in the user's project. The project is served as a static website (plain HTML, CSS, and vanilla JS — no build step, no npm). The entry file MUST be "index.html" and must work when opened directly. You may load a CDN <link>/<script> (e.g. the Tailwind Play CDN) but never anything that needs a local server or bundler. Use CSS, emoji, or inline SVG for visuals — no binary assets.

How to work:
- Start building immediately from the user's idea. Make reasonable, tasteful assumptions instead of asking.
- Maintain a short plan with update_plan, then build it piece by piece with write_file/edit_file.
- Use list_files and read_file to stay aware of what exists. Prefer edit_file for small changes.
- Write real, specific copy — never lorem ipsum, never placeholders. Make it genuinely good: responsive, accessible, on-brand.
- When the user asks for a change, make it directly and confirm briefly.

Asking questions:
- Ask at most ONE question per turn, and ONLY when you are truly blocked and cannot make a reasonable assumption.
- Never ask about something you can infer from the idea or the files. Never ask more than one thing.
- When you must ask, call ask_user with 2–5 concrete, plain-language options. This ends your turn.

Keep your chat messages short and friendly. The user is non-technical — no jargon.`;
```

- [ ] **Step 3: Write the failing test** — `apps/server/src/modules/agent/agent-loop.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { simulateReadableStream } from "ai";
import { InMemoryFileStore } from "./file-store.js";
import { ProjectFS } from "./project-fs.js";
import { runAgentTurn } from "./agent-loop.js";
import type { AgentEvent } from "./tools.js";

// A mock that emits a write_file tool call on its first call, then a final
// text message on its second call (so the loop terminates cleanly).
function scriptedModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      call += 1;
      if (call === 1) {
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "tool-input-start", id: "1", toolName: "write_file" },
              {
                type: "tool-call",
                toolCallId: "1",
                toolName: "write_file",
                input: JSON.stringify({ path: "index.html", content: "<h1>Hello</h1>" }),
              },
              { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ],
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "0" },
            { type: "text-delta", id: "0", delta: "Done — your homepage is ready." },
            { type: "text-end", id: "0" },
            { type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ],
        }),
      };
    },
  });
}

describe("runAgentTurn", () => {
  it("runs tool calls and writes files, then returns the final text", async () => {
    const fs = new ProjectFS(new InMemoryFileStore());
    const events: AgentEvent[] = [];

    const { text } = await runAgentTurn({
      model: scriptedModel(),
      messages: [{ role: "user", content: "Build me a homepage" }],
      fs,
      onEvent: (e) => events.push(e),
    });

    expect(await fs.readFile("index.html")).toBe("<h1>Hello</h1>");
    expect(events).toContainEqual({ type: "file", action: "write", path: "index.html" });
    expect(text).toContain("ready");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter server test -- agent-loop`
Expected: FAIL — cannot find module `./agent-loop.js`.

- [ ] **Step 5: Implement** — `apps/server/src/modules/agent/agent-loop.ts`

```ts
import { streamText, stepCountIs, hasToolCall, type ModelMessage, type LanguageModel } from "ai";
import { ProjectFS } from "./project-fs.js";
import { createTools, type AgentEvent } from "./tools.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export const MAX_STEPS = 16;

interface RunOpts {
  model: LanguageModel;
  messages: ModelMessage[];
  fs: ProjectFS;
  onEvent: (e: AgentEvent) => void;
}

/**
 * Run one agent turn: drive the tool-calling loop to completion, forwarding
 * streamed text and tool events through `onEvent`. Returns the final text.
 * The turn ends when the model stops, calls ask_user, or hits MAX_STEPS.
 */
export async function runAgentTurn({ model, messages, fs, onEvent }: RunOpts): Promise<{ text: string }> {
  const tools = createTools(fs, onEvent);

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("ask_user")],
    maxOutputTokens: 8000,
  });

  // Consuming fullStream drives the whole loop (including tool execution).
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      // v6 names the field `text`; fall back to `textDelta` defensively.
      const delta = (part as { text?: string; textDelta?: string }).text
        ?? (part as { textDelta?: string }).textDelta
        ?? "";
      if (delta) onEvent({ type: "text", delta });
    } else if (part.type === "error") {
      const message = part.error instanceof Error ? part.error.message : String(part.error);
      onEvent({ type: "error", message });
    }
  }

  const text = await result.text;
  return { text };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter server test -- agent-loop`
Expected: PASS (1 test). If the mock chunk shape errors, run `pnpm --filter server test` and adjust chunk field names to match the installed `ai` version's stream-part types (the test is the contract; keep `runAgentTurn` unchanged).

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/modules/agent/system-prompt.ts apps/server/src/modules/agent/agent-loop.ts apps/server/src/modules/agent/agent-loop.test.ts packages/ai/src/index.ts
git commit -m "feat(agent): add system prompt and runAgentTurn loop driver"
```

---

## Task 6: Drizzle-backed `DbFileStore` + `MessageStore`

**Files:**
- Create: `apps/server/src/modules/agent/db-file-store.ts`
- Create: `apps/server/src/modules/agent/message-store.ts`

**Interfaces:**
- Consumes: `db, file as fileTable, message as messageTable, eq, and` from `@repo/database`; `FileStore, StoredFile` from `./file-store.js`.
- Produces:
  - `class DbFileStore implements FileStore` — `new DbFileStore(projectId: string)`.
  - `interface ChatMessage { id: string; role: string; content: string; parts: unknown[] | null; createdAt: Date }`
  - `async function loadHistory(projectId: string): Promise<ChatMessage[]>` (ordered by `createdAt`).
  - `async function appendMessage(projectId: string, role: string, content: string, parts?: unknown[]): Promise<ChatMessage>`.

- [ ] **Step 1: Implement `DbFileStore`** — `apps/server/src/modules/agent/db-file-store.ts`

```ts
import { randomUUID } from "node:crypto";
import { db, file as fileTable, eq, and } from "@repo/database";
import type { FileStore, StoredFile } from "./file-store.js";

/** FileStore backed by the `file` table, scoped to one project. */
export class DbFileStore implements FileStore {
  constructor(private readonly projectId: string) {}

  async list(): Promise<StoredFile[]> {
    const rows = await db
      .select({ path: fileTable.path, content: fileTable.content })
      .from(fileTable)
      .where(eq(fileTable.projectId, this.projectId))
      .orderBy(fileTable.path);
    return rows;
  }

  async get(path: string): Promise<string | null> {
    const rows = await db
      .select({ content: fileTable.content })
      .from(fileTable)
      .where(and(eq(fileTable.projectId, this.projectId), eq(fileTable.path, path)));
    return rows[0]?.content ?? null;
  }

  async put(path: string, content: string): Promise<void> {
    const now = new Date();
    await db
      .insert(fileTable)
      .values({ id: randomUUID(), projectId: this.projectId, path, content, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [fileTable.projectId, fileTable.path],
        set: { content, updatedAt: now },
      });
  }

  async remove(path: string): Promise<boolean> {
    const deleted = await db
      .delete(fileTable)
      .where(and(eq(fileTable.projectId, this.projectId), eq(fileTable.path, path)))
      .returning({ id: fileTable.id });
    return deleted.length > 0;
  }
}
```

- [ ] **Step 2: Implement `MessageStore`** — `apps/server/src/modules/agent/message-store.ts`

```ts
import { randomUUID } from "node:crypto";
import { db, message as messageTable, eq } from "@repo/database";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  parts: unknown[] | null;
  createdAt: Date;
}

export async function loadHistory(projectId: string): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(messageTable)
    .where(eq(messageTable.projectId, projectId))
    .orderBy(messageTable.createdAt);
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
    parts: (r.parts as unknown[] | null) ?? null,
    createdAt: r.createdAt,
  }));
}

export async function appendMessage(
  projectId: string,
  role: string,
  content: string,
  parts: unknown[] = [],
): Promise<ChatMessage> {
  const row = {
    id: randomUUID(),
    projectId,
    role,
    content,
    parts,
    createdAt: new Date(),
  };
  await db.insert(messageTable).values(row);
  return { id: row.id, role, content, parts, createdAt: row.createdAt };
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter server check-types`
Expected: PASS (no type errors). If `onConflictDoUpdate` target typing complains, confirm the unique index from Task 1 is present in `schema.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/modules/agent/db-file-store.ts apps/server/src/modules/agent/message-store.ts
git commit -m "feat(agent): add Drizzle FileStore and message persistence"
```

---

## Task 7: Agent controller, routes, preview runtime

**Files:**
- Create: `apps/server/src/modules/agent/runtime.ts`
- Create: `apps/server/src/modules/agent/agent.controller.ts`
- Create: `apps/server/src/modules/agent/agent.routes.ts`
- Modify: `packages/schemas/src/index.ts` (add `AgentChatInputSchema`)
- Modify: `apps/server/src/routes/index.ts` (mount `agentRouter`)

**Interfaces:**
- Consumes: `DbFileStore`, `loadHistory`/`appendMessage`, `ProjectFS`, `runAgentTurn`, `resolveModel`, `DEFAULT_MODEL_ID`.
- Produces: routes `POST /api/projects/:id/agent/chat` (SSE), `GET /api/projects/:id/agent/messages`, `GET /api/projects/:id/preview/*`.

- [ ] **Step 1: Add the input schema** — append to `packages/schemas/src/index.ts`

```ts
export const AgentChatInputSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(5000),
  modelId: z.string().optional(),
});
export type AgentChatInput = z.infer<typeof AgentChatInputSchema>;
```

- [ ] **Step 2: Create the runtime/content-type helper** — `apps/server/src/modules/agent/runtime.ts`

```ts
const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  txt: "text/plain; charset=utf-8",
};

/** Map a file path to a Content-Type for the preview server. */
export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}

/**
 * Preview seam. Phase 1 serves files directly from the file store via the
 * preview route, so the URL is just the server path. Later phases can return
 * a sandbox URL (E2B/Daytona) without changing callers.
 */
export interface Runtime {
  previewPath(projectId: string): string;
}

export const localRuntime: Runtime = {
  previewPath: (projectId) => `/api/projects/${projectId}/preview/`,
};
```

- [ ] **Step 3: Create the controller** — `apps/server/src/modules/agent/agent.controller.ts`

```ts
import { Response, NextFunction } from "express";
import { AgentChatInputSchema } from "@repo/schemas";
import { db, project as projectTable, eq, and } from "@repo/database";
import { resolveModel, DEFAULT_MODEL_ID } from "@repo/ai";
import type { ModelMessage } from "ai";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";
import { ProjectFS } from "./project-fs.js";
import { DbFileStore } from "./db-file-store.js";
import { loadHistory, appendMessage } from "./message-store.js";
import { runAgentTurn } from "./agent-loop.js";
import type { AgentEvent } from "./tools.js";
import { contentTypeFor } from "./runtime.js";

async function ownedProject(userId: string, id: string) {
  const rows = await db
    .select()
    .from(projectTable)
    .where(and(eq(projectTable.id, id), eq(projectTable.userId, userId)));
  if (!rows[0]) throw new AppError("Project not found", 404);
  return rows[0];
}

export const AgentController = {
  /** POST /api/projects/:id/agent/chat — stream one agent turn over SSE. */
  async chat(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };
      await ownedProject(req.user.id, id);

      const { message, modelId } = AgentChatInputSchema.parse(req.body);

      // Persist the user's message, then build the model's view of the chat.
      await appendMessage(id, "user", message);
      const history = await loadHistory(id);
      const messages: ModelMessage[] = history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const send = (event: AgentEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      const collected: AgentEvent[] = [];

      const fs = new ProjectFS(new DbFileStore(id));
      const model = resolveModel(modelId ?? DEFAULT_MODEL_ID);

      let finalText = "";
      try {
        const { text } = await runAgentTurn({
          model,
          messages,
          fs,
          onEvent: (e) => {
            collected.push(e);
            send(e);
          },
        });
        finalText = text;
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "The agent hit an error." });
      }

      // Persist the assistant turn (text + the non-text events as parts).
      const parts = collected.filter((e) => e.type !== "text");
      await appendMessage(id, "assistant", finalText, parts);
      await db.update(projectTable).set({ updatedAt: new Date() }).where(eq(projectTable.id, id));

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects/:id/agent/messages — full chat history. */
  async messages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };
      await ownedProject(req.user.id, id);
      const messages = await loadHistory(id);
      res.status(200).json({ status: "success", data: { messages } });
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects/:id/preview/* — serve a project file into the iframe. */
  async preview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError("Not authenticated", 401);
      const { id } = req.params as { id: string };
      await ownedProject(req.user.id, id);

      // Everything after ".../preview/" is the file path; default to index.html.
      const rest = (req.params as Record<string, string>)["0"] ?? "";
      const path = rest === "" || rest.endsWith("/") ? `${rest}index.html` : rest;

      const content = await new DbFileStore(id).get(path);
      if (content === null) {
        res.status(404).type("text/plain").send(`Not found: ${path}`);
        return;
      }
      res.setHeader("Content-Type", contentTypeFor(path));
      res.setHeader("Cache-Control", "no-store");
      res.send(content);
    } catch (err) {
      next(err);
    }
  },
};
```

- [ ] **Step 4: Create the routes** — `apps/server/src/modules/agent/agent.routes.ts`

```ts
import { Router } from "express";
import { AgentController } from "./agent.controller.js";
import { authGuard } from "../../middleware/auth.middleware.js";

// mergeParams so ":id" from the parent mount is visible here.
const router = Router({ mergeParams: true });

router.post("/:id/agent/chat", authGuard, AgentController.chat);
router.get("/:id/agent/messages", authGuard, AgentController.messages);
router.get("/:id/preview/*", authGuard, AgentController.preview);

export const agentRouter = router;
```

- [ ] **Step 5: Mount the router** — modify `apps/server/src/routes/index.ts`

Add the import near the other module imports:

```ts
import { agentRouter } from "../modules/agent/agent.routes.js";
```

Add the mount immediately after the existing `router.use("/projects", projectsRouter);` line:

```ts
router.use("/projects", agentRouter);
```

- [ ] **Step 6: Apply the migration + start the server**

Run: `pnpm --filter @repo/database db:migrate`  (requires `DATABASE_URL`)
Expected: applies the `message`/`file` tables.

Run: `pnpm --filter server dev`
Expected: server boots on :5001 with no errors.

- [ ] **Step 7: Manual verification (end-to-end agent turn)**

With a valid session cookie and an existing `projectId` you own, run:

```bash
curl -N -X POST http://localhost:5001/api/projects/<PROJECT_ID>/agent/chat \
  -H "Content-Type: application/json" \
  -b "<your-session-cookie>" \
  -d '{"message":"Build a landing page for a dog-walking service called PawPal"}'
```

Expected: a stream of `data: {...}` lines — `plan`, multiple `file` events, `text` deltas, then `{"type":"done"}`.

Then open in a browser (logged in): `http://localhost:5001/api/projects/<PROJECT_ID>/preview/`
Expected: the generated landing page renders.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/modules/agent/runtime.ts apps/server/src/modules/agent/agent.controller.ts apps/server/src/modules/agent/agent.routes.ts apps/server/src/routes/index.ts packages/schemas/src/index.ts
git commit -m "feat(agent): add chat (SSE), messages, and preview endpoints"
```

---

## Task 8: Web workspace — chat + live preview

**Files:**
- Create: `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx`
- Modify: `apps/web/app/dashboard/[id]/page.tsx`

**Interfaces:**
- Consumes: `BACKEND_URL` (`process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001"`); the chat SSE endpoint; the messages endpoint; the preview endpoint.
- Produces: `AgentWorkspace({ projectId, projectTitle }: { projectId: string; projectTitle: string })` default export.

- [ ] **Step 1: Create the workspace component** — `apps/web/app/dashboard/[id]/_components/agent-workspace.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

type AgentEvent =
  | { type: "plan"; items: string[] }
  | { type: "file"; action: "write" | "edit" | "delete"; path: string }
  | { type: "question"; question: string; options: string[]; multiSelect: boolean }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done" };

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  question?: { question: string; options: string[]; multiSelect: boolean };
}

export default function AgentWorkspace({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [plan, setPlan] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const previewUrl = `${BACKEND_URL}/api/projects/${projectId}/preview/`;

  // Load existing history on mount.
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/projects/${projectId}/agent/messages`, { credentials: "include" })
      .then((r) => r.json())
      .then((res) => {
        const msgs = res?.data?.messages ?? [];
        setTurns(
          msgs.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            text: m.content,
          })),
        );
        if (msgs.length > 0) setPreviewKey((k) => k + 1);
      })
      .catch(() => {});
  }, [projectId]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    setTurns((t) => [...t, { role: "user", text }, { role: "assistant", text: "" }]);

    const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}/agent/chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let filesChanged = false;

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const payload = line.replace(/^data: /, "").trim();
        if (!payload) continue;
        let ev: AgentEvent;
        try {
          ev = JSON.parse(payload) as AgentEvent;
        } catch {
          continue;
        }
        if (ev.type === "text") {
          setTurns((t) => {
            const copy = [...t];
            copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + ev.delta };
            return copy;
          });
        } else if (ev.type === "plan") {
          setPlan(ev.items);
        } else if (ev.type === "file") {
          filesChanged = true;
        } else if (ev.type === "question") {
          setTurns((t) => {
            const copy = [...t];
            copy[copy.length - 1] = { ...copy[copy.length - 1], question: ev };
            return copy;
          });
        } else if (ev.type === "error") {
          setTurns((t) => {
            const copy = [...t];
            copy[copy.length - 1] = { ...copy[copy.length - 1], text: `⚠️ ${ev.message}` };
            return copy;
          });
        }
      }
    }

    if (filesChanged) setPreviewKey((k) => k + 1);
    setBusy(false);
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[1fr_1.4fr]">
      {/* Chat pane */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--gray-alpha-200)] bg-[var(--background-100)]">
        <div className="border-b border-[var(--gray-alpha-200)] px-4 py-3">
          <p className="text-[13px] font-semibold text-[var(--gray-1000)]">{projectTitle}</p>
          {plan.length > 0 && (
            <ul className="mt-2 space-y-1">
              {plan.map((item, i) => (
                <li key={i} className="text-[12px] text-[var(--gray-700)]">• {item}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {turns.map((turn, i) => (
            <div key={i} className={turn.role === "user" ? "text-right" : "text-left"}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] ${
                  turn.role === "user"
                    ? "bg-[var(--gray-1000)] text-[var(--background-100)]"
                    : "bg-[var(--background-200)] text-[var(--gray-1000)]"
                }`}
              >
                {turn.text || (busy && i === turns.length - 1 ? "…" : "")}
              </div>
              {turn.question && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {turn.question.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => void send(opt)}
                      className="rounded-full border border-[var(--gray-alpha-300)] px-3 py-1.5 text-[13px] text-[var(--gray-1000)] hover:bg-[var(--background-200)]"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--gray-alpha-200)] p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              placeholder="Describe what you want, or ask for a change…"
              className="flex-1 rounded-lg border border-[var(--gray-alpha-300)] bg-[var(--field-background)] px-3 py-2 text-[13px] text-[var(--gray-1000)] focus:border-[var(--gray-1000)] focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="geist-btn geist-btn-primary disabled:opacity-40"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
        </div>
      </div>

      {/* Preview pane */}
      <div className="overflow-hidden rounded-2xl border border-[var(--gray-alpha-200)] bg-white">
        <div className="flex h-8 items-center gap-1.5 border-b border-[var(--gray-alpha-200)] bg-[var(--background-200)] px-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--gray-300)]" />
        </div>
        <iframe key={previewKey} src={previewUrl} className="h-[calc(100%-2rem)] w-full" title="Live preview" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render the workspace from the project page**

In `apps/web/app/dashboard/[id]/page.tsx`, replace the contents of the `{showProject && project && (...)}` `<main>` block's inner studio grid with the workspace. Minimal change: import the component at the top —

```tsx
import AgentWorkspace from "./_components/agent-workspace";
```

— and inside the `showProject` branch, render `<AgentWorkspace projectId={project.id} projectTitle={project.title} />` in place of the existing `<div className="mt-8 grid ...">` studio grid. Leave the header and meta block as-is.

- [ ] **Step 3: Run the app and verify end-to-end**

Run (two terminals): `pnpm --filter server dev` and `pnpm --filter web dev`
Open the web app, sign in, create/open a project, and type: *"Build a landing page for a coffee subscription called Daily Grind."*
Expected: a plan appears, file pills/text stream into the chat, and within a few seconds the right pane shows the rendered site. Then type *"make the header dark green"* and confirm the preview updates.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/dashboard/[id]/_components/agent-workspace.tsx apps/web/app/dashboard/[id]/page.tsx
git commit -m "feat(web): add conversational agent workspace with live preview"
```

---

## Self-Review

**1. Spec coverage:**
- Agent loop / tool-calling (spec §5.2–5.3) → Tasks 4, 5. ✓
- "Dumb questions" fix: assumptions-first prompt + terminal `ask_user` (spec §5.5) → Task 4 (`ask_user`), Task 5 (`SYSTEM_PROMPT`, `hasToolCall` stop). ✓
- Visible plan (spec §4) → `update_plan` tool (Task 4) + plan rendering (Task 8). ✓
- Guardrails: MAX_STEPS, token budget, errors-as-results (spec §5.4) → Task 5 (`stopWhen`, `maxOutputTokens`), Task 4 (`asResult`). ✓
- Data model `message` + `file` (spec §6) → Task 1. ✓
- Live preview behind a `Runtime` seam (spec §7) → Task 7 (`runtime.ts`, preview route). ✓
- Two-pane workspace (spec §8) → Task 8. ✓
- Streaming (spec §4) → Task 7 SSE + Task 8 reader. ✓
- Testing: ProjectFS, tools, loop with stub model (spec §11) → Tasks 3, 4, 5. ✓
- Deferred items (spec §12: undo, templates, sandbox, InsForge, deploy, self-correction) → correctly absent. ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to" — each step has full code or an exact command. ✓

**3. Type consistency:** `FileStore`/`StoredFile` (Task 2) consumed unchanged by `ProjectFS` (Task 3), `DbFileStore` (Task 6). `AgentEvent` (Task 4) consumed by `agent-loop` (Task 5) and controller (Task 7). `runAgentTurn({ model, messages, fs, onEvent }) → { text }` consistent across Tasks 5 and 7. `resolveModel` exported (Task 5) and used (Task 7). ✓

**One known watch-point:** the AI SDK v6 `fullStream` part field names and the test mock chunk shapes (Task 5) can drift by minor version. `runAgentTurn` reads `text-delta` defensively; if the Task 5 test fails on chunk shape, adjust the test's mock chunks to the installed version — the production code is the stable contract.
