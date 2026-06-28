import { describe, it, expect } from "vitest";
import { MockLanguageModelV3, simulateReadableStream } from "ai/test";
import { InMemoryFileStore } from "./file-store.js";
import { ProjectFS } from "./project-fs.js";
import { runAgentTurn } from "./agent-loop.js";
import type { AgentEvent } from "./tools.js";

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

// A mock that emits a write_file tool call on its first call, then a final
// text message on its second call (so the loop terminates cleanly).
function scriptedModel() {
  let call = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      call += 1;
      if (call === 1) {
        return {
          stream: simulateReadableStream({
            // Provider stream-part literals; cast keeps the mock readable.
            chunks: [
              { type: "stream-start", warnings: [] },
              { type: "tool-input-start", id: "1", toolName: "write_file" },
              {
                type: "tool-call",
                toolCallId: "1",
                toolName: "write_file",
                input: JSON.stringify({ path: "index.html", content: "<h1>Hello</h1>" }),
              },
              { type: "finish", finishReason: "tool-calls", usage },
            ] as any,
          }),
        };
      }
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "0" },
            { type: "text-delta", id: "0", delta: "Done — your homepage is ready." },
            { type: "text-end", id: "0" },
            { type: "finish", finishReason: "stop", usage },
          ] as any,
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
