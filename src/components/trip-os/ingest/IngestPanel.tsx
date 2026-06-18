"use client";

import { useEffect, useRef, useState } from "react";

import { runImportChat, type ImportChatTurn } from "@/lib/client/run-import-chat";
import { runTripDocumentImport } from "@/lib/client/run-trip-document-import";
import type { TripImportProgress } from "@/types/trip-import-progress";

import { AsyncButton } from "../shared/AsyncButton";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

const EXAMPLE_PROMPTS = [
  "Build this Europe trip starting Tuesday 16 July 2026.",
  "This is last year's booklet — shift all dates to July 2026.",
  "Import the attached PDF. Flights and hotels are on pages 2–5.",
] as const;

const textareaClass =
  "w-full resize-none rounded-2xl border-0 bg-zinc-100 px-4 py-3 text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30";

function progressLabel(event: TripImportProgress | null): string | null {
  if (!event) return null;
  switch (event.type) {
    case "phase":
      if (event.phase === "reading") return "Reading document…";
      if (event.phase === "planning") return "Planning trip outline…";
      if (event.phase === "structure") return "Building locations and stays…";
      if (event.phase === "structure_applied") return "Applying structure…";
      if (event.phase === "building") return "Adding activities…";
      return "Importing…";
    case "day_start":
      return `Day ${event.index}/${event.total}: ${event.cityLabel}`;
    case "item_added":
      return `Adding ${event.title}…`;
    case "done":
      return `Done — ${event.stats.itemsCreated} item(s) created`;
    default:
      return null;
  }
}

function summarizeUserMessage(text: string): string {
  const trimmed = text.trim();
  const lines = trimmed.split("\n").filter((line) => line.trim().length > 0);
  const firstLine = lines[0]?.trim() ?? trimmed;
  const preview =
    firstLine.length > 72 ? `${firstLine.slice(0, 71)}…` : firstLine;

  if (lines.length > 6 || trimmed.length > 320) {
    return `Pasted itinerary · ${lines.length} line${lines.length === 1 ? "" : "s"} · ${preview}`;
  }
  return trimmed;
}

function UserMessageBody({ text }: { text: string }) {
  const trimmed = text.trim();
  const lines = trimmed.split("\n");
  const isLong = trimmed.length > 320 || lines.length > 6;

  if (!isLong) {
    return <p className="whitespace-pre-wrap">{trimmed}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-violet-100">
        Pasted itinerary · {lines.length} line{lines.length === 1 ? "" : "s"}
      </p>
      <div className="max-h-40 overflow-y-auto rounded-xl bg-violet-500/35 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap">
        {trimmed}
      </div>
    </div>
  );
}

function renderAssistantText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function IngestPanel(props: {
  tripId: string;
  timezone: string;
  onReload: () => void;
}) {
  const [messages, setMessages] = useState<ImportChatTurn[]>([]);
  const [draftText, setDraftText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<TripImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function preventBrowserFileDrop(e: DragEvent) {
      e.preventDefault();
    }
    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
    };
  }, []);

  function attachFile(file: File | null) {
    setAttachedFile(file);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onDropZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) attachFile(file);
  }

  const hasSource = Boolean(importFile || sourceText.trim() || draftText.trim());
  const canSend = Boolean(draftText.trim() || attachedFile) && !chatBusy && !importing;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed && !attachedFile) return;

    const userLine =
      trimmed ||
      (attachedFile ? `Please review ${attachedFile.name} and help me import it.` : "");
    const chatUserLine = trimmed ? summarizeUserMessage(trimmed) : userLine;
    const nextSourceText = [sourceText, trimmed].filter(Boolean).join("\n\n").trim();
    if (trimmed) setSourceText(nextSourceText);

    const fileForChat = attachedFile ?? importFile;
    if (attachedFile) {
      setImportFile(attachedFile);
      attachFile(null);
    }

    const nextMessages: ImportChatTurn[] = [
      ...messages,
      { role: "user", text: chatUserLine, fullText: trimmed || undefined },
    ];
    setMessages(nextMessages);
    setDraftText("");
    setChatBusy(true);
    setError(null);

    try {
      const result = await runImportChat({
        tripId: props.tripId,
        messages: nextMessages.map((message) => ({
          role: message.role,
          text:
            message.role === "user" && message.fullText
              ? message.fullText
              : message.text,
        })),
        pastedText: nextSourceText,
        file: fileForChat,
      });
      if (!result.ok) throw new Error(result.error);

      const { status, assistantReply, importInstructions } = result.result;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: assistantReply,
          readyToImport: status === "ready_to_import",
          importInstructions: importInstructions ?? null,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatBusy(false);
    }
  }

  async function runImport(importInstructions: string | null) {
    if (importing) return;
    const textBlob = sourceText.trim();
    const fileBlob =
      importFile ??
      (textBlob
        ? new File([textBlob], "pasted-itinerary.txt", { type: "text/plain" })
        : null);

    if (!fileBlob) {
      setError("Paste your itinerary or attach a file before importing.");
      return;
    }

    setImporting(true);
    setError(null);
    setProgress(null);

    try {
      const result = await runTripDocumentImport({
        tripId: props.tripId,
        file: fileBlob,
        fileName: importFile?.name ?? "pasted-itinerary.txt",
        instructions: importInstructions,
        documentText: sourceText.trim() || null,
        onProgress: setProgress,
      });
      if (!result.ok) throw new Error(result.error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Imported successfully — ${result.stats.itemsCreated} activity item(s) added. Your calendar should now reflect the trip.`,
        },
      ]);
      setSourceText("");
      setImportFile(null);
      attachFile(null);
      props.onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const status = progressLabel(progress);
  const latestReady = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.readyToImport);

  return (
    <TripSectionShell
      eyebrow="Ingestion"
      title="AI / Import"
      description="Chat with the importer — it will ask for missing dates before building your trip."
      fill
    >
      <TripSoftPanel
        title="Import assistant"
        className="flex h-full min-h-0 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600">
                  Paste your itinerary, drop a PDF, or describe the trip. If dates are unclear
                  (no month or year), I&apos;ll ask before importing.
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Examples
                  </p>
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setDraftText(prompt)}
                      className="block w-full rounded-xl border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={[
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      message.role === "user"
                        ? "ml-8 bg-violet-600 text-white"
                        : "mr-4 bg-zinc-100 text-zinc-800",
                    ].join(" ")}
                  >
                    <div>
                      {message.role === "assistant" ? (
                        <p className="whitespace-pre-wrap">
                          {renderAssistantText(message.text)}
                        </p>
                      ) : (
                        <UserMessageBody text={message.fullText ?? message.text} />
                      )}
                    </div>
                    {message.role === "assistant" && message.readyToImport ? (
                      <AsyncButton
                        onClick={() => void runImport(message.importInstructions ?? null)}
                        loading={importing}
                        loadingLabel="Importing…"
                        disabled={chatBusy}
                        className="mt-3 inline-flex h-9 items-center rounded-full bg-violet-600 px-4 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                      >
                        Import trip
                      </AsyncButton>
                    ) : null}
                  </div>
                ))}
              </>
            )}
            {chatBusy ? (
              <p className="text-sm text-zinc-500">Thinking…</p>
            ) : null}
          </div>

          <div className="mt-3 shrink-0 space-y-3 border-t border-zinc-200/80 pt-3">
          {attachedFile ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
              <span className="truncate font-medium">{attachedFile.name}</span>
              <button
                type="button"
                onClick={() => attachFile(null)}
                disabled={chatBusy || importing}
                className="shrink-0 text-xs font-medium text-violet-700 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : null}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={onDropZoneDrop}
            className={[
              "mt-3 rounded-2xl border-2 border-dashed px-4 py-3 transition",
              dragActive
                ? "border-violet-400 bg-violet-50/80"
                : "border-transparent bg-zinc-50",
            ].join(" ")}
          >
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Paste itinerary rows, add clarifications, or ask questions…"
              rows={4}
              disabled={chatBusy || importing}
              className={textareaClass}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canSend) void sendMessage(draftText);
                }
              }}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <TripPrimaryButton
              variant="ghost"
              type="button"
              disabled={chatBusy || importing}
              onClick={() => fileInputRef.current?.click()}
            >
              Attach file
            </TripPrimaryButton>
            <AsyncButton
              onClick={() => void sendMessage(draftText)}
              loading={chatBusy}
              loadingLabel="Thinking…"
              disabled={!canSend}
              className="inline-flex h-10 items-center rounded-full bg-violet-600 px-5 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </AsyncButton>
            {latestReady && !importing ? (
              <AsyncButton
                onClick={() => void runImport(latestReady.importInstructions ?? null)}
                loading={importing}
                loadingLabel="Importing…"
                disabled={chatBusy}
                className="inline-flex h-10 items-center rounded-full border border-violet-300 bg-white px-5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                Import trip
              </AsyncButton>
            ) : null}
            {hasSource && !chatBusy && !importing ? (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setDraftText("");
                  setSourceText("");
                  setImportFile(null);
                  attachFile(null);
                  setError(null);
                  setProgress(null);
                }}
                className="text-sm text-zinc-600 hover:underline"
              >
                Start over
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
              onChange={(e) => attachFile(e.target.files?.[0] ?? null)}
              disabled={chatBusy || importing}
              className="sr-only"
            />
          </div>

          {status ? <p className="text-sm text-violet-800">{status}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
        </div>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
