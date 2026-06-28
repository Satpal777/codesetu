"use client";

import { useEffect, useState, useRef } from "react";

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

export default function AgentWorkspace({
  projectId,
  projectTitle,
  modelId,
}: {
  projectId: string;
  projectTitle: string;
  modelId?: string;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [plan, setPlan] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const previewUrl = `${BACKEND_URL}/api/projects/${projectId}/preview/`;

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

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
          }))
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
      body: JSON.stringify({ message: text, modelId }),
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
    <div className="grid h-[calc(100vh-10rem)] gap-4 lg:grid-cols-[1fr_1.4fr] overflow-hidden">
      {/* Chat pane */}
      <div className="flex flex-col overflow-hidden rounded border border-[var(--border-default)] bg-[var(--bg-raised)] shadow-sm">
        
        {/* Chat header */}
        <div className="border-b border-[var(--border-subtle)] px-4 py-3 bg-[var(--bg-raised)]">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">{projectTitle}</p>
          {plan.length > 0 && (
            <div className="mt-2.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">To-do list</p>
              <ul className="space-y-1">
                {plan.map((item, i) => (
                  <li key={i} className="text-[12px] text-[var(--text-secondary)] flex gap-1.5 items-start">
                    <span className="text-[var(--text-tertiary)]">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Message window */}
        <div className="flex-1 space-y-5 overflow-y-auto p-4 bg-white">
          {turns.map((turn, i) => {
            const isUser = turn.role === "user";
            
            return (
              <div
                key={i}
                className={`flex gap-3 w-full animate-[msgIn_0.25s_ease] ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {/* Assistant icon */}
                {!isUser && (
                  <div className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[3px] bg-[var(--ink-950)] text-white">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M3 16 Q12 4 21 16" />
                      <line x1="3" y1="16" x2="3" y2="20" />
                      <line x1="21" y1="16" x2="21" y2="20" />
                      <line x1="12" y1="9" x2="12" y2="20" />
                    </svg>
                  </div>
                )}

                <div className="flex flex-col gap-1 max-w-[85%]">
                  {!isUser && (
                    <span className="font-mono text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                      CodeSetu
                    </span>
                  )}

                  <div
                    className={`whitespace-pre-wrap text-[13px] leading-relaxed ${
                      isUser
                        ? "rounded-[12px_12px_2px_12px] bg-[var(--fill-muted)] px-3.5 py-2 text-[var(--text-primary)]"
                        : "text-[var(--text-primary)] px-0.5 py-0.5"
                    }`}
                  >
                    {turn.text || (busy && i === turns.length - 1 ? "…" : "")}
                  </div>

                  {turn.question && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {turn.question.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => void send(opt)}
                          className="press cursor-pointer rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--fill-muted)] hover:border-[var(--border-strong)]"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <div className="border-t border-[var(--border-subtle)] p-3 bg-[var(--bg-inset)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2 items-center"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              placeholder="Ask the builder to make a change…"
              className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-2 text-[13.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--border-strong)] focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="cs-btn cs-btn-sm cs-btn-solid font-semibold disabled:opacity-40 shrink-0"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
          <div className="mt-2 font-mono text-[9px] text-[var(--text-tertiary)] tracking-wide">
            ⌘↵ to send · Describe edits (e.g. &quot;make the background gray&quot;)
          </div>
        </div>
      </div>

      {/* Preview pane */}
      <div className="overflow-hidden rounded border border-[var(--border-default)] bg-white shadow-sm flex flex-col">
        <div className="flex h-8 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)]" />
            <span className="h-2 w-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)]" />
            <span className="h-2 w-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)]" />
          </div>
          <div className="flex items-center gap-3">
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="font-sans text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              Open in new tab ↗
            </a>
            <span className="font-mono text-[10px] text-[var(--text-tertiary)] tracking-wider">PREVIEW</span>
          </div>
        </div>
        <iframe key={previewKey} src={previewUrl} className="flex-1 w-full bg-white" title="Live preview" />
      </div>
    </div>
  );
}
