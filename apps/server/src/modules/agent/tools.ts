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
      description:
        "List every file in the project with its path. Call this to see what already exists before editing.",
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
