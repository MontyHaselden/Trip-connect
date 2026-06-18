import type { ImportReadinessResult } from "@/lib/ai/assess-import-readiness";

export type ImportChatTurn = {
  role: "user" | "assistant";
  text: string;
  fullText?: string;
  readyToImport?: boolean;
  importInstructions?: string | null;
};

export async function runImportChat(params: {
  tripId: string;
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  pastedText?: string | null;
  file?: File | null;
}): Promise<{ ok: true; result: ImportReadinessResult } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("messages", JSON.stringify(params.messages));
  if (params.pastedText?.trim()) {
    form.set("pastedText", params.pastedText.trim());
  }
  if (params.file) {
    form.set("file", params.file, params.file.name);
  }

  const res = await fetch(`/api/trips/${params.tripId}/import-chat`, {
    method: "POST",
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: typeof body.error === "string" ? body.error : "Could not reach import assistant.",
    };
  }

  return { ok: true, result: body as ImportReadinessResult };
}
