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

  // Immutably update the most recent (assistant) turn.
  function updateLast(fn: (turn: ChatTurn) => ChatTurn) {
    setTurns((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (!last) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = fn(last);
      return copy;
    });
  }

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
          updateLast((last) => ({ ...last, text: last.text + ev.delta }));
        } else if (ev.type === "plan") {
          setPlan(ev.items);
        } else if (ev.type === "file") {
          filesChanged = true;
        } else if (ev.type === "question") {
          updateLast((last) => ({
            ...last,
            question: { question: ev.question, options: ev.options, multiSelect: ev.multiSelect },
          }));
        } else if (ev.type === "error") {
          updateLast((last) => ({ ...last, text: `⚠️ ${ev.message}` }));
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
