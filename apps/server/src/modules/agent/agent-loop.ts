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
  systemPrompt?: string;
}

/**
 * Run one agent turn: drive the tool-calling loop to completion, forwarding
 * streamed text and tool events through `onEvent`. Returns the final text.
 * The turn ends when the model stops, calls ask_user, or hits MAX_STEPS.
 */
export async function runAgentTurn({ model, messages, fs, onEvent, systemPrompt }: RunOpts): Promise<{ text: string }> {
  const tools = createTools(fs, onEvent);

  const result = streamText({
    model,
    system: systemPrompt || SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: [stepCountIs(MAX_STEPS), hasToolCall("ask_user")],
    maxOutputTokens: 8000,
  });

  // Consuming fullStream drives the whole loop (including tool execution).
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      // streamText's fullStream names the field `delta`; fall back defensively.
      const delta = (part as { delta?: string; text?: string }).delta
        ?? (part as { text?: string }).text
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
