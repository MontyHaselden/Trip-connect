"use client";

import { DateTime } from "luxon";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ItineraryTree } from "@/components/host/itinerary/types";
import {
  formatChangeScopePrompt,
  resolveDefaultTodayDate,
  type ChangeScopeMode,
} from "@/lib/ai/change-scope";
import type { ChangeScopeInput } from "@/lib/ai/change-scope-schema";
import { runTripDocumentImport } from "@/lib/client/run-trip-document-import";
import type { TripImportProgress } from "@/types/trip-import-progress";

const EXAMPLE_PROMPTS = [
  "Create a Japan trip from 5 July to 21 July.",
  "This is last year's booklet — move all dates to this year and ignore the photos.",
  "Add a pre-trip meeting on 22 May at class B lunch.",
  "On Tuesday everyone goes to sumo, but Jack and Noah go to samurai instead.",
  "Move the Osaka dinner from 6pm to 7pm.",
] as const;

const SCOPE_OPTIONS: Array<{ mode: ChangeScopeMode; label: string }> = [
  { mode: "today", label: "Today" },
  { mode: "whole_trip", label: "Whole trip" },
  { mode: "dates", label: "Other" },
];

function formatDayChip(iso: string) {
  return DateTime.fromISO(iso).toFormat("ccc d MMM");
}

function buildChangeScopeInput(
  mode: ChangeScopeMode,
  todayDate: string,
  selectedDates: string[],
): ChangeScopeInput {
  if (mode === "today") return { mode: "today", date: todayDate };
  if (mode === "whole_trip") return { mode: "whole_trip" };
  return { mode: "dates", dates: selectedDates };
}

export function AiChatPanel(props: {
  tripId: string;
  inviteCode: string;
  timezone: string;
  startDate: string;
  endDate: string;
  onClose?: () => void;
  onProposal: (data: {
    proposalId: string;
    assistantReply: string;
    needsClarification: boolean;
    proposedChanges: Array<{ summary: string }>;
    warnings: string[];
  }) => void;
  onDocumentImported?: () => void;
  onImportProgress?: (event: TripImportProgress) => void;
}) {
  const {
    tripId,
    inviteCode,
    timezone,
    startDate,
    endDate,
    onClose,
    onProposal,
    onDocumentImported,
    onImportProgress,
  } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [scopeMode, setScopeMode] = useState<ChangeScopeMode>("today");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [tripDays, setTripDays] = useState<Array<{ date: string; label: string }>>([]);

  const todayDate = useMemo(
    () => resolveDefaultTodayDate(timezone, startDate, endDate),
    [timezone, startDate, endDate],
  );

  const changeScope = useMemo(
    () => buildChangeScopeInput(scopeMode, todayDate, selectedDates),
    [scopeMode, todayDate, selectedDates],
  );

  const scopeReady =
    scopeMode !== "dates" || selectedDates.length > 0;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/host/${encodeURIComponent(inviteCode)}/itinerary`)
      .then((r) => r.json())
      .then((tree: ItineraryTree) => {
        if (cancelled || !tree?.days) return;
        setTripDays(
          tree.days.map((day) => ({
            date: day.date,
            label: day.calendarLabel?.trim() || day.cityLabel,
          })),
        );
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  function toggleSelectedDate(date: string) {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort(),
    );
  }

  async function sendChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !scopeReady) return;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    try {
      const res = await fetch(`/api/trips/${tripId}/ai-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, changeScope }),
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

  async function sendDocumentImport() {
    if (!attachedFile || busy || !scopeReady) return;
    const instructions = input.trim();
    const scopeLine = formatChangeScopePrompt(changeScope);
    const combinedInstructions = [scopeLine, instructions].filter(Boolean).join("\n\n");
    const userLine = instructions
      ? `Import PDF: ${attachedFile.name}\n${instructions}`
      : `Import PDF: ${attachedFile.name}`;
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: userLine }]);
    setInput("");
    try {
      const result = await runTripDocumentImport({
        tripId,
        file: attachedFile,
        fileName: attachedFile.name,
        instructions: combinedInstructions || null,
        onProgress: onImportProgress,
      });
      if (!result.ok) throw new Error(result.error);

      const stats = result.stats;
      const reply = stats
        ? `Imported your document. Added ${stats.daysCreated} day(s), updated ${stats.daysUpdated}, created ${stats.itemsCreated} activity item(s). Check the preview.`
        : "Imported your document. Check the preview on the right.";

      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onDocumentImported?.();
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: err instanceof Error ? err.message : "Document import failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit() {
    if (attachedFile) {
      void sendDocumentImport();
      return;
    }
    void sendChat(input);
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-zinc-200 bg-white">
      <div className="flex items-start justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">AI trip editor</h2>
          <p className="text-xs text-zinc-500">
            Upload a PDF or describe changes. Add instructions like &quot;move dates to
            this year&quot; with your file.
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 shrink-0 text-sm text-zinc-500"
            aria-label="Close"
          >
            ✕
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Try an example:</p>
            {EXAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setInput(p)}
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
          onSubmit();
        }}
        className="border-t border-zinc-100 p-3"
      >
        {attachedFile ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <span className="truncate">{attachedFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setAttachedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="shrink-0 font-medium"
            >
              Remove
            </button>
          </div>
        ) : null}
        <div className="mb-2">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Apply changes to
          </p>
          <div className="flex gap-1">
            {SCOPE_OPTIONS.map(({ mode, label }) => {
              const active = scopeMode === mode;
              const todayLabel =
                mode === "today"
                  ? `${label} · ${DateTime.fromISO(todayDate).toFormat("d MMM")}`
                  : label;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setScopeMode(mode)}
                  className={[
                    "min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-zinc-900 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  {todayLabel}
                </button>
              );
            })}
          </div>
          {scopeMode === "dates" ? (
            <div className="mt-2">
              <p className="mb-1 text-[11px] text-zinc-500">Select one or more days</p>
              <div className="max-h-24 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {tripDays.map((day) => {
                    const selected = selectedDates.includes(day.date);
                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => toggleSelectedDate(day.date)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          selected
                            ? "bg-zinc-900 text-white"
                            : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                        ].join(" ")}
                        title={day.label}
                      >
                        {formatDayChip(day.date)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {!scopeReady ? (
                <p className="mt-1 text-[11px] text-amber-700">Pick at least one day.</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder={
            attachedFile
              ? "Tell the AI what to do with this file (e.g. move all dates to 2026, ignore photos)…"
              : "Type a change, or attach a PDF…"
          }
          className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setAttachedFile(file);
          }}
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="h-9 shrink-0 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-700 disabled:opacity-50"
          >
            Attach PDF
          </button>
          <button
            type="submit"
            disabled={busy || !scopeReady || (!attachedFile && !input.trim())}
            className="h-9 min-w-0 flex-1 rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? attachedFile
                ? "Importing…"
                : "Thinking…"
              : attachedFile
                ? "Import document"
                : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
