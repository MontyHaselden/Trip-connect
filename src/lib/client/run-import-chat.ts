import type { ImportReadinessResult as ServerImportReadinessResult } from "@/lib/ai/assess-import-readiness";

import type { ActivityDraft } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

export type ImportChatTurn = {
  role: "user" | "assistant";
  text: string;
  fullText?: string;
  attachedFileName?: string;
  readyToImport?: boolean;
  importInstructions?: string | null;
  proposedCommands?: TripCommand[];
  commandSummaries?: string[];
  applied?: boolean;
  dismissed?: boolean;
};

export type ImportReadinessResult = ServerImportReadinessResult & {
  /** Extracted itinerary text persisted for follow-up messages without re-uploading. */
  sourceText?: string;
  attachedFileName?: string | null;
  proposedCommands?: TripCommand[];
  commandSummaries?: string[];
  warnings?: string[];
};

export async function runImportChat(params: {
  tripId: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  pastedText?: string | null;
  file?: File | null;
  clientActivities?: ActivityDraft[];
  signal?: AbortSignal;
}): Promise<{ ok: true; result: ImportReadinessResult } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("messages", JSON.stringify(params.messages));
  if (params.pastedText?.trim()) {
    form.set("pastedText", params.pastedText.trim());
  }
  if (params.clientActivities?.length) {
    form.set("clientActivities", JSON.stringify(params.clientActivities));
  }
  if (params.file) {
    form.set("file", params.file, params.file.name);
  }

  const res = await fetch(`/api/trips/${params.tripId}/import-chat`, {
    method: "POST",
    body: form,
    signal: params.signal,
  });

  const body = await res.json().catch(() => ({}));
  if (typeof body.assistantReply === "string") {
    return { ok: true, result: body as ImportReadinessResult };
  }
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof body.error === "string"
          ? body.error
          : "I couldn't reach the import assistant just now — try sending that again.",
    };
  }

  return { ok: true, result: body as ImportReadinessResult };
}
