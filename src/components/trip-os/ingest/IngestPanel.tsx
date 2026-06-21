"use client";

import { useEffect, useRef, useState } from "react";

import { runImportChat, type ImportChatTurn } from "@/lib/client/run-import-chat";
import {
  clearAssistantChat,
  loadAssistantChat,
  saveAssistantChat,
} from "@/lib/client/assistant-chat-session";
import { runTripChat } from "@/lib/client/run-trip-chat";
import { runTripDocumentImport } from "@/lib/client/run-trip-document-import";
import { tripBuildPhaseComplete } from "@/lib/client/trip-build-phase";
import { isImageUploadFile, isItineraryDocumentFile } from "@/lib/documents/is-image-upload";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { TripImportProgress } from "@/types/trip-import-progress";

import { AsyncButton } from "../shared/AsyncButton";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

const EXAMPLE_PROMPTS = [
  "Fill in the gaps on the calendar.",
  "Clear everything and start over.",
  "We're in Paris from the 22nd to the 25th — extend the stay.",
  "Add a Louvre visit on 2026-07-23 at 10:00.",
] as const;

function looksLikeItineraryPaste(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lines = trimmed.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length >= 4) return true;
  if (trimmed.length > 400) return true;
  return /\b\d{4}-\d{2}-\d{2}\b/.test(trimmed) && lines.length >= 2 && trimmed.length > 120;
}

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

function looksLikeTripEditRequest(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return /\b(remove|clear|delete|reset|start\s+over|fill|fix|move|change|wrong|calendar|leg|stay|activity|transport|everything|all|wipe|undo|still\s+there|gap|tokyo|kyoto|extend|trim|shift)\b/i.test(
    trimmed,
  );
}

export function IngestPanel(props: {
  tripId: string;
  groupId: string;
  timezone: string;
  calendarHasPaint: boolean;
  onReload: () => void;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [messages, setMessages] = useState<ImportChatTurn[]>([]);
  const [draftText, setDraftText] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<TripImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingCommands, setApplyingCommands] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAssistantChat(props.tripId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        const buildComplete = tripBuildPhaseComplete(result.session.messages);
        const skipDocumentState = buildComplete || props.calendarHasPaint;
        setMessages(result.session.messages);
        setSourceText(skipDocumentState ? "" : result.session.sourceText);
        if (skipDocumentState) {
          setDocumentFileName(null);
          if (result.session.sourceText.trim()) {
            void saveAssistantChat(props.tripId, {
              messages: result.session.messages,
              sourceText: "",
            });
          }
        } else {
          const lastAttachment = [...result.session.messages]
            .reverse()
            .find((message) => message.role === "user" && message.attachedFileName);
          if (lastAttachment?.attachedFileName) {
            setDocumentFileName(lastAttachment.attachedFileName);
          } else if (result.session.sourceText.trim()) {
            setDocumentFileName("Attached document");
          }
        }
      }
      setSessionLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [props.tripId, props.calendarHasPaint]);

  async function persistSession(
    nextMessages: ImportChatTurn[],
    nextSourceText = sourceText,
  ) {
    const result = await saveAssistantChat(props.tripId, {
      messages: nextMessages,
      sourceText: nextSourceText,
    });
    if (!result.ok) {
      setError(result.error);
    }
  }

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

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, chatBusy]);

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

  const hasSource = Boolean(
    importFile ||
      attachedFile ||
      (!tripBuildPhaseComplete(messages) && sourceText.trim()) ||
      draftText.trim(),
  );
  const canSend =
    Boolean(draftText.trim() || attachedFile) && !chatBusy && !importing && !applyingCommands;

  function inImportPrepFlow(): boolean {
    if (tripBuildPhaseComplete(messages) || props.calendarHasPaint) return false;
    return (
      sourceText.trim().length > 0 ||
      messages.some((message) => message.readyToImport !== undefined)
    );
  }

  function shouldUseImportChat(trimmed: string): boolean {
    const file = attachedFile ?? importFile;
    if (props.calendarHasPaint) {
      if (looksLikeTripEditRequest(trimmed)) return false;
      if (file && isImageUploadFile(file)) return false;
      if (file && isItineraryDocumentFile(file)) {
        if (looksLikeItineraryPaste(trimmed)) return true;
        if (/\b(import|replace|re-import|upload|from scratch)\b/i.test(trimmed)) return true;
        return false;
      }
      return false;
    }
    if (file) return true;
    if (looksLikeItineraryPaste(trimmed)) return true;
    return inImportPrepFlow();
  }

  function clearAttachedDocument() {
    attachFile(null);
    setImportFile(null);
    setDocumentFileName(null);
  }

  function assistantFallbackReply(): string {
    return "I wasn't able to work that out just now. Tell me the dates, cities, or activities you want changed — I'll propose changes for you to confirm.";
  }

  async function applyProposedCommands(commands: TripCommand[], messageIndex: number) {
    if (!commands.length || applyingCommands) return;
    setApplyingCommands(true);
    setError(null);
    try {
      const ok = await props.onDispatch(commands);
      if (!ok) throw new Error("Could not apply changes.");

      const updatedMessages: ImportChatTurn[] = messages.map((message, index) =>
        index === messageIndex
          ? { ...message, applied: true, proposedCommands: undefined }
          : message,
      );
      const withFollowUp: ImportChatTurn[] = [
        ...updatedMessages,
        {
          role: "assistant",
          text: "Applied — check the calendar on the right. If anything still looks off, tell me which dates or cities to fix.",
        },
      ];
      setMessages(withFollowUp);
      await persistSession(withFollowUp);
      props.onReload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not apply changes.";
      const withFollowUp: ImportChatTurn[] = [
        ...messages,
        {
          role: "assistant",
          text: `I couldn't apply those changes (${msg}). Tell me what to adjust and I'll propose a new set of changes.`,
        },
      ];
      setMessages(withFollowUp);
      await persistSession(withFollowUp);
    } finally {
      setApplyingCommands(false);
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed && !attachedFile) return;

    const fileForChat = attachedFile ?? importFile;
    const useImport = shouldUseImportChat(trimmed);
    const fileNameForTurn = attachedFile?.name ?? importFile?.name ?? documentFileName ?? undefined;

    if (attachedFile) {
      setImportFile(attachedFile);
      setDocumentFileName(attachedFile.name);
      attachFile(null);
    }

    const chatUserLine = (() => {
      if (fileForChat && trimmed) {
        return `📎 ${fileForChat.name} — ${summarizeUserMessage(trimmed)}`;
      }
      if (fileForChat) return `Attached ${fileForChat.name}`;
      return trimmed;
    })();

    const nextSourceText =
      useImport && trimmed && !fileForChat && !sourceText.trim()
        ? [sourceText, trimmed].filter(Boolean).join("\n\n").trim()
        : sourceText;
    if (useImport && trimmed && !fileForChat && !sourceText.trim()) {
      setSourceText(nextSourceText);
    }

    const nextMessages: ImportChatTurn[] = [
      ...messages,
      {
        role: "user",
        text: chatUserLine,
        fullText: trimmed || undefined,
        attachedFileName: fileNameForTurn,
      },
    ];
    setMessages(nextMessages);
    setDraftText("");
    setChatBusy(true);
    setError(null);

    try {
      let finalMessages: ImportChatTurn[] = nextMessages;

      if (useImport) {
        const result = await runImportChat({
          tripId: props.tripId,
          messages: nextMessages.map((message) => ({
            role: message.role,
            text:
              message.role === "user" && message.fullText
                ? message.fullText
                : message.text,
          })),
          pastedText: nextSourceText || sourceText,
          file: fileForChat,
        });
        if (!result.ok) {
          finalMessages = [
            ...nextMessages,
            { role: "assistant", text: result.error || assistantFallbackReply() },
          ];
          setMessages(finalMessages);
          await persistSession(finalMessages, nextSourceText || sourceText);
        } else {
        const {
          status,
          assistantReply,
          importInstructions,
          sourceText: persistedSource,
          proposedCommands,
          commandSummaries,
          warnings,
        } = result.result;
        if (persistedSource?.trim()) {
          setSourceText(persistedSource);
        }
        if (result.result.attachedFileName) {
          setDocumentFileName(result.result.attachedFileName);
        }
        const warningNote =
          warnings && warnings.length > 0
            ? `\n\nNote: ${warnings.slice(0, 2).join(" ")}`
            : "";
        finalMessages = [
          ...nextMessages,
          {
            role: "assistant",
            text: `${assistantReply}${warningNote}`,
            readyToImport: status === "ready_to_import",
            importInstructions: importInstructions ?? null,
            proposedCommands:
              proposedCommands && proposedCommands.length > 0 ? proposedCommands : undefined,
            commandSummaries,
          },
        ];
        setMessages(finalMessages);
        await persistSession(
          finalMessages,
          persistedSource?.trim() || nextSourceText || sourceText,
        );
        }
      } else {
        const result = await runTripChat({
          tripId: props.tripId,
          groupId: props.groupId,
          messages: nextMessages.map((message) => ({
            role: message.role,
            text:
              message.role === "user" && message.fullText
                ? message.fullText
                : message.text,
          })),
        });
        if (!result.ok) {
          finalMessages = [
            ...nextMessages,
            { role: "assistant", text: result.error || assistantFallbackReply() },
          ];
          setMessages(finalMessages);
        } else {
        const {
          assistantReply,
          needsClarification,
          proposedCommands,
          commandSummaries,
          warnings,
        } = result.result;

        const warningNote =
          warnings.length > 0 ? `\n\nNote: ${warnings.slice(0, 2).join(" ")}` : "";

        finalMessages = [
          ...nextMessages,
          {
            role: "assistant",
            text: `${assistantReply}${warningNote}`,
            proposedCommands:
              !needsClarification && proposedCommands.length > 0
                ? proposedCommands
                : undefined,
            commandSummaries:
              commandSummaries.length > 0 ? commandSummaries : undefined,
          },
        ];
        setMessages(finalMessages);
        }
      }

      if (!useImport) {
        await persistSession(finalMessages, nextSourceText);
      }
    } catch {
      const finalMessages: ImportChatTurn[] = [
        ...nextMessages,
        { role: "assistant", text: assistantFallbackReply() },
      ];
      setMessages(finalMessages);
      await persistSession(finalMessages, nextSourceText);
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

      const { stats, postImportMessage, fillProposal } = result.result;
      let importMessages: ImportChatTurn[] = [
        ...messages,
        {
          role: "assistant",
          text:
            postImportMessage ??
            `Imported successfully — ${stats.itemsCreated} activity item(s) added. Check the calendar and tell me if any dates, legs, or stays look wrong.`,
          proposedCommands: fillProposal?.proposedCommands,
          commandSummaries: fillProposal?.commandSummaries,
        },
      ];

      if (fillProposal?.proposedCommands?.length) {
        const applied = await props.onDispatch(fillProposal.proposedCommands);
        if (applied) {
          importMessages = importMessages.map((message, index) =>
            index === importMessages.length - 1
              ? { ...message, applied: true, proposedCommands: undefined }
              : message,
          );
          importMessages = [
            ...importMessages,
            {
              role: "assistant",
              text: "I filled the empty calendar days between your city stays automatically. Tell me what still looks wrong, or ask what to tackle next.",
            },
          ];
        }
      }

      setMessages(importMessages);
      setSourceText("");
      setImportFile(null);
      setDocumentFileName(null);
      attachFile(null);
      await persistSession(importMessages, "");
      try {
        props.onReload();
      } catch {
        // Import succeeded; calendar refresh is best-effort.
      }
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

  const latestPendingApplyIndex = (() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message?.role === "assistant" &&
        message.proposedCommands?.length &&
        !message.applied
      ) {
        return index;
      }
    }
    return -1;
  })();
  const latestPendingApply =
    latestPendingApplyIndex >= 0 ? messages[latestPendingApplyIndex] : null;

  return (
    <TripSectionShell
      eyebrow="Ingestion"
      title="AI / Import"
      description="Chat with Trip OS — change the calendar, add activities, or import an itinerary. You confirm before anything is saved."
      fill
    >
      <TripSoftPanel
        title="Trip assistant"
        className="flex h-full min-h-0 flex-col"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            ref={messagesScrollRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1"
          >
            {!sessionLoaded ? (
              <p className="text-sm text-zinc-500">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-600">
                  Ask me to change the trip, fill calendar gaps, or add activities. Paste a full
                  itinerary or drop a PDF when you want to import from scratch — I&apos;ll ask for
                  missing dates first.
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
                    {message.role === "assistant" && message.proposedCommands?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.commandSummaries?.length ? (
                          <ul className="list-inside list-disc text-xs text-zinc-700">
                            {message.commandSummaries.map((summary, summaryIndex) => (
                              <li key={summaryIndex}>{summary}</li>
                            ))}
                          </ul>
                        ) : null}
                        {message.applied ? (
                          <p className="text-xs font-medium text-emerald-700">Applied</p>
                        ) : index === latestPendingApplyIndex ? (
                          <p className="text-xs text-zinc-500">
                            Use <span className="font-medium">Apply changes</span> below to confirm.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
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
          {latestPendingApply?.proposedCommands?.length ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3">
              {latestPendingApply.commandSummaries?.length ? (
                <ul className="mb-3 list-inside list-disc text-xs text-violet-950">
                  {latestPendingApply.commandSummaries.map((summary, summaryIndex) => (
                    <li key={summaryIndex}>{summary}</li>
                  ))}
                </ul>
              ) : null}
              <AsyncButton
                onClick={() =>
                  void applyProposedCommands(
                    latestPendingApply.proposedCommands!,
                    latestPendingApplyIndex,
                  )
                }
                loading={applyingCommands}
                loadingLabel="Applying…"
                disabled={chatBusy || importing}
                className="inline-flex h-10 w-full items-center justify-center rounded-full bg-violet-600 px-5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Apply changes
              </AsyncButton>
            </div>
          ) : null}
          {(() => {
            const activeFile = attachedFile ?? importFile;
            const label = activeFile?.name ?? documentFileName;
            const showChip =
              label && (!tripBuildPhaseComplete(messages) || activeFile);
            if (!showChip) return null;
            return (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
                <span className="truncate font-medium">
                  📎 {label}
                  {sourceText.trim() && !activeFile ? " · saved for this chat" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => clearAttachedDocument()}
                  disabled={chatBusy || importing}
                  className="shrink-0 text-xs font-medium text-violet-700 hover:underline"
                >
                  Remove
                </button>
              </div>
            );
          })()}

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
              placeholder="Attach a file and add a comment, paste an itinerary, or ask to change the trip…"
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
                  void clearAssistantChat(props.tripId);
                  setMessages([]);
                  setDraftText("");
                  setSourceText("");
                  setImportFile(null);
                  setDocumentFileName(null);
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
