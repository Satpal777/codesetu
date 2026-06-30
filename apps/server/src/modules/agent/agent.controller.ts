import { Request, Response, NextFunction } from "express";
import { AgentChatInputSchema } from "@repo/schemas";
import { db, project as projectTable, artifact as artifactTable, eq, and } from "@repo/database";
import { resolveModel, DEFAULT_MODEL_ID, availableModels } from "@repo/ai";
import type { ModelMessage } from "ai";
import { AuthenticatedRequest } from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";
import { ProjectFS } from "./project-fs.js";
import { DbFileStore } from "./db-file-store.js";
import { loadHistory, appendMessage } from "./message-store.js";
import { runAgentTurn } from "./agent-loop.js";
import type { AgentEvent } from "./tools.js";
import { contentTypeFor, getRuntime } from "./runtime.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

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

      const send = (event: AgentEvent | { type: "done" }) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      const collected: AgentEvent[] = [];

      const fs = new ProjectFS(new DbFileStore(id));
      const effectiveModelId = modelId ?? availableModels()[0]?.id ?? DEFAULT_MODEL_ID;
      const model = resolveModel(effectiveModelId);

      // Load generated SDLC planning documents (PRD and Tasks) to guide the agent
      const artifacts = await db
        .select()
        .from(artifactTable)
        .where(eq(artifactTable.projectId, id));

      const prd = artifacts.find((a) => a.type === "prd");
      const tasks = artifacts.find((a) => a.type === "tasks");

      let systemPrompt = SYSTEM_PROMPT;
      if (prd) {
        const prdContent = typeof prd.content === "string" ? prd.content : JSON.stringify(prd.content, null, 2);
        systemPrompt += `\n\n[SDLC CONTEXT - PRODUCT REQUIREMENTS DOCUMENT (PRD)]:\n${prdContent}`;
      }
      if (tasks) {
        const tasksContent = typeof tasks.content === "string" ? tasks.content : JSON.stringify(tasks.content, null, 2);
        systemPrompt += `\n\n[SDLC CONTEXT - DEVELOPMENT CHECKS & TASKS]:\n${tasksContent}`;
      }

      let finalText = "";
      try {
        const { text } = await runAgentTurn({
          model,
          messages,
          fs,
          systemPrompt,
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

      send({ type: "done" });
      res.end();
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/projects/:id/messages — full chat history. */
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

      const fileStore = new DbFileStore(id);
      let files = await fileStore.list();

      // Populate file store from implementation artifact if empty
      if (files.length === 0) {
        const implRows = await db
          .select()
          .from(artifactTable)
          .where(and(eq(artifactTable.projectId, id), eq(artifactTable.type, "implementation")));
        const implArtifact = implRows[0];
        if (implArtifact) {
          const content = implArtifact.content as { files?: { path: string; content: string }[] } | undefined;
          const generatedFiles = content?.files ?? [];
          for (const file of generatedFiles) {
            await fileStore.put(file.path, file.content);
          }

          // Generate and write planning documents as downloadable markdown files
          const allArtifacts = await db
            .select()
            .from(artifactTable)
            .where(eq(artifactTable.projectId, id));

          const prdArtifact = allArtifacts.find((a) => a.type === "prd");
          if (prdArtifact) {
            const prdMd = formatPrdMarkdown(prdArtifact.content);
            const prdHtml = buildHtmlDocument("Product Requirements Document (PRD)", prdMd);
            await fileStore.put("docs/PRD.html", prdHtml);
          }

          const tasksArtifact = allArtifacts.find((a) => a.type === "tasks");
          if (tasksArtifact) {
            const tasksMd = formatTasksMarkdown(tasksArtifact.content);
            const tasksHtml = buildHtmlDocument("WBS Development Checklist", tasksMd);
            await fileStore.put("docs/TASKS.html", tasksHtml);
          }

          const thinkingArtifact = allArtifacts.find((a) => a.type === "product_thinking");
          if (thinkingArtifact) {
            const thinkingMd = formatUserProfileMarkdown(thinkingArtifact.content);
            const thinkingHtml = buildHtmlDocument("Product User Profiles & Target Alignment", thinkingMd);
            await fileStore.put("docs/USER_PROFILES.html", thinkingHtml);
          }

          files = await fileStore.list();
        }
      }

      // If no files have been generated yet, serve a friendly compilation loader
      if (files.length === 0) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Compiling Preview...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #fafafa;
      color: #171717;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid #eaeaea;
      border-top: 2px solid #171717;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h2 { font-size: 14px; font-weight: 600; margin: 0 0 4px; }
    p { font-size: 11px; color: #666; margin: 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a; color: #f4f4f4; }
      .spinner { border-color: #2a2a2a; border-top-color: #f4f4f4; }
      p { color: #8a8a8a; }
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Compiling application...</h2>
  <p>The live preview will start automatically once files are ready.</p>
</body>
</html>
        `);
        return;
      }

      if (process.env.DAYTONA_API_KEY) {
        const basePreview = await getRuntime().previewPath(id);
        const urlObj = new URL(basePreview);
        // Ensure path starts with a /
        urlObj.pathname = path.startsWith("/") ? path : `/${path}`;

        // Reverse proxy the preview request to the Daytona sandbox using the skip-warning header
        const response = await fetch(urlObj.toString(), {
          headers: {
            "X-Daytona-Skip-Preview-Warning": "true",
          },
        });

        const contentType = response.headers.get("content-type") || contentTypeFor(path);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "no-store");

        const arrayBuffer = await response.arrayBuffer();
        res.status(response.status).send(Buffer.from(arrayBuffer));
        return;
      }

      const matchingFile = files.find((f) => f.path === path);
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

      const matchingFile = files.find((f) => f.path === path);
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
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrdMarkdown(prdContent: any): string {
  let md = `# Product Requirements Document (PRD)\n\n`;
  if (!prdContent) return md + "*No PRD available.*";

  const data = typeof prdContent === "string" ? JSON.parse(prdContent) : prdContent;

  if (data.title) md += `# ${escapeHtml(data.title)}\n\n`;
  if (data.description) md += `## Description\n${escapeHtml(data.description)}\n\n`;

  if (data.targetAudience && Array.isArray(data.targetAudience)) {
    md += `## Target Audience\n`;
    data.targetAudience.forEach((a: string) => md += `- ${a}\n`);
    md += `\n`;
  }

  if (data.features && Array.isArray(data.features)) {
    md += `## Features & Functional Scope\n`;
    data.features.forEach((f: any) => {
      if (typeof f === "string") {
        md += `- ${f}\n`;
      } else if (f && typeof f === "object") {
        md += `- **${escapeHtml(f.name || f.title || "Feature")}**: ${f.description || ""}\n`;
      }
    });
    md += `\n`;
  }

  if (data.outOfScope && Array.isArray(data.outOfScope)) {
    md += `## Out of Scope (Non-Goals)\n`;
    data.outOfScope.forEach((item: string) => md += `- ${item}\n`);
    md += `\n`;
  }

  return md;
}

function formatTasksMarkdown(tasksContent: any): string {
  let md = `# WBS Development Checklist\n\n`;
  if (!tasksContent) return md + "*No WBS tasks checklist available.*";

  const data = typeof tasksContent === "string" ? JSON.parse(tasksContent) : tasksContent;
  const list = data.tasks || data || [];

  if (Array.isArray(list)) {
    list.forEach((t: any, i: number) => {
      const name = typeof t === "string" ? t : t.title || t.name || `Task ${i + 1}`;
      const desc = typeof t === "string" ? "" : t.description ? `: ${t.description}` : "";
      md += `- [ ] **Task ${i + 1}**: ${name}${desc}\n`;
    });
  }
  return md;
}

function formatUserProfileMarkdown(thinkingContent: any): string {
  let md = `# Product User Profiles & Target Alignment\n\n`;
  if (!thinkingContent) return md + "*No user profiles available.*";

  const data = typeof thinkingContent === "string" ? JSON.parse(thinkingContent) : thinkingContent;

  if (data.targetUser) md += `## Target User Profile\n${escapeHtml(data.targetUser)}\n\n`;
  if (data.coreValue) md += `## Core Value Proposition\n${escapeHtml(data.coreValue)}\n\n`;

  if (data.userPersonas && Array.isArray(data.userPersonas)) {
    md += `## Detailed User Personas\n`;
    data.userPersonas.forEach((p: any) => {
      if (typeof p === "string") {
        md += `- ${p}\n`;
      } else if (p && typeof p === "object") {
        md += `- **${p.name || "Persona"}** (${p.role || ""}): ${p.needs || p.details || ""}\n`;
      }
    });
    md += `\n`;
  }

  if (data.risks && Array.isArray(data.risks)) {
    md += `## Risks & Mitigation Strategies\n`;
    data.risks.forEach((r: any) => {
      if (typeof r === "string") {
        md += `- ${r}\n`;
      } else if (r && typeof r === "object") {
        md += `- **Risk**: ${r.risk || ""}\n  **Mitigation**: ${r.mitigation || ""}\n`;
      }
    });
  }

  return md;
}

function markdownToHtml(md: string): string {
  let html = md;
  // Convert headers (h1 to h3)
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  // Convert bold text
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  
  // Convert checkboxes
  html = html.replace(/^\-\s+\[\s*\]\s+(.+)$/gm, '<li><input type="checkbox" disabled style="margin-right: 6px;"> $1</li>');
  
  // Convert normal list items
  html = html.replace(/^\-\s+(.+)$/gm, "<li>$1</li>");
  
  // Wrap list items in ul blocks
  const lines = html.split("\n");
  let inList = false;
  const processedLines = [];
  for (const line of lines) {
    const isLi = line.trim().startsWith("<li>");
    if (isLi && !inList) {
      processedLines.push("<ul>");
      inList = true;
    } else if (!isLi && inList) {
      processedLines.push("</ul>");
      inList = false;
    }
    processedLines.push(line);
  }
  if (inList) {
    processedLines.push("</ul>");
  }
  return processedLines.join("\n");
}

function buildHtmlDocument(title: string, markdown: string): string {
  const bodyHtml = markdownToHtml(markdown);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Georgia, Serif;
      color: #1a1a1a;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #fff;
    }
    .header-card {
      border-bottom: 2px solid #111;
      padding-bottom: 20px;
      margin-bottom: 40px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 20px;
      font-size: 13px;
      color: #555;
    }
    .meta-item strong {
      color: #111;
    }
    h1 { font-size: 28px; font-weight: 700; margin: 0; color: #111; }
    h2 { font-size: 18px; font-weight: 600; margin: 30px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 6px; color: #111; }
    p { margin: 0 0 16px; font-size: 14px; }
    ul { margin: 0 0 16px; padding-left: 20px; font-size: 14px; }
    li { margin-bottom: 6px; }
    strong { font-weight: 600; }
    
    /* Print action bar */
    .action-bar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
    .btn-print {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #fff;
      background: #111;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
    }
    .btn-print:hover {
      background: #333;
    }
    
    @media print {
      .action-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <button class="btn-print" onclick="window.print()">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
      Print / Save to PDF
    </button>
  </div>
  <div class="header-card">
    <p style="margin:0; text-transform:uppercase; font-size:10px; letter-spacing:0.1em; color:#666;">Industry Standard SDLC Document</p>
    <h1 style="margin-top:6px;">${escapeHtml(title)}</h1>
    <div class="meta-grid">
      <div class="meta-item"><strong>Origin:</strong> CodeSetu Platform</div>
      <div class="meta-item"><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
      <div class="meta-item"><strong>Document Type:</strong> System Specification</div>
      <div class="meta-item"><strong>Status:</strong> Approved v1.0</div>
    </div>
  </div>
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;
}
