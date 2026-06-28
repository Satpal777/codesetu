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

      const send = (event: AgentEvent | { type: "done" }) => res.write(`data: ${JSON.stringify(event)}\n\n`);
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

      send({ type: "done" });
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
