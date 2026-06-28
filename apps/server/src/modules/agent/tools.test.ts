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
