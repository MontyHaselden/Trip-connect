import type { TripCommand } from "@/lib/trip-engine/commands";
import type { TripImportProgress } from "@/types/trip-import-progress";

export type TripDocumentImportResult = {
  stats: { daysCreated: number; daysUpdated: number; itemsCreated: number };
  postImportMessage?: string;
  fillProposal?: {
    assistantReply: string;
    proposedCommands: TripCommand[];
    commandSummaries: string[];
  } | null;
};

export async function runTripDocumentImport(params: {
  tripId: string;
  file: Blob;
  fileName: string;
  instructions: string | null;
  documentText?: string | null;
  onProgress?: (event: TripImportProgress) => void;
}): Promise<{ ok: true; result: TripDocumentImportResult } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("file", params.file, params.fileName);
  if (params.instructions) {
    form.set("instructions", params.instructions);
  }
  if (params.documentText?.trim()) {
    form.set("documentText", params.documentText.trim());
  }

  const res = await fetch(`/api/trips/${params.tripId}/import-document`, {
    method: "POST",
    body: form,
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok && contentType.includes("application/json")) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      error:
        typeof body.error === "string" ? body.error : "Document import failed.",
    };
  }

  const reader = res.body?.getReader();
  if (!reader) {
    return { ok: false, error: "Document import failed." };
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let doneEvent: Extract<TripImportProgress, { type: "done" }> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let event: TripImportProgress;
      try {
        event = JSON.parse(line) as TripImportProgress;
      } catch {
        continue;
      }

      params.onProgress?.(event);

      if (event.type === "error") {
        return { ok: false, error: event.error };
      }
      if (event.type === "done") {
        doneEvent = event;
      }
    }
  }

  if (!res.ok) {
    return { ok: false, error: "Document import failed." };
  }

  if (!doneEvent) {
    return { ok: false, error: "Document import ended unexpectedly." };
  }

  return {
    ok: true,
    result: {
      stats: doneEvent.stats,
      postImportMessage: doneEvent.postImportMessage,
      fillProposal: doneEvent.fillProposal ?? null,
    },
  };
}
