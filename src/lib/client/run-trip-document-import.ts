import type { TripImportProgress } from "@/types/trip-import-progress";

export async function runTripDocumentImport(params: {
  tripId: string;
  file: Blob;
  fileName: string;
  instructions: string | null;
  onProgress?: (event: TripImportProgress) => void;
}): Promise<
  | {
      ok: true;
      stats: { daysCreated: number; daysUpdated: number; itemsCreated: number };
    }
  | { ok: false; error: string }
> {
  const form = new FormData();
  form.set("file", params.file, params.fileName);
  if (params.instructions) {
    form.set("instructions", params.instructions);
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
  let stats: { daysCreated: number; daysUpdated: number; itemsCreated: number } | null =
    null;

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
        stats = event.stats;
      }
    }
  }

  if (!res.ok) {
    return { ok: false, error: "Document import failed." };
  }

  if (!stats) {
    return { ok: false, error: "Document import ended unexpectedly." };
  }

  return { ok: true, stats };
}
