"use client";

import { useState } from "react";

const EXAMPLE_PROMPTS = [
  "Create a Japan trip from 5 July to 21 July.",
  "Add a pre-trip meeting on 22 May at class B lunch.",
  "On Tuesday everyone goes to sumo, but Jack and Noah go to samurai instead.",
  "Move the Osaka dinner from 6pm to 7pm.",
  "Add 20 emergency phrases for Japan.",
] as const;

export function AiChatPanel(props: {
  tripId: string;
  onProposal: (data: {
    proposalId: string;
    assistantReply: string;
    needsClarification: boolean;
    proposedChanges: Array<{ summary: string }>;
    warnings: string[];
  }) => void;
}) {
  const { tripId, onProposal } = props;
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    try {
      const res = await fetch(`/api/trips/${tripId}/ai-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Chat failed");
      setMessages((m) => [...m, { role: "assistant", text: body.assistantReply }]);
      onProposal(body);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold">AI trip editor</h2>
        <p className="text-xs text-zinc-500">Describe changes in plain language.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Try an example:</p>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => send(p)}
                className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={[
                "rounded-lg px-3 py-2 text-sm",
                m.role === "user" ? "ml-8 bg-zinc-900 text-white" : "mr-8 bg-zinc-100 text-zinc-800",
              ].join(" ")}
            >
              {m.text}
            </div>
          ))
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-zinc-100 p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder="Type a change…"
          className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="mt-2 h-9 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
