import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { normalizeImportInstructions } from "@/lib/documents/document-import-instructions";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { importTripFromDocumentText } from "@/lib/host/import-trip-from-document";
import type { TripImportProgress } from "@/types/trip-import-progress";

export const runtime = "nodejs";
export const maxDuration = 300;

function importErrorResponse(err: unknown) {
  const msg = err instanceof Error ? err.message : "Import failed.";
  if (msg.includes("OPENAI_API_KEY")) {
    return NextResponse.json({ error: msg }, { status: 503 });
  }
  if (
    msg.includes("AI could not") ||
    msg.includes("Could not parse") ||
    msg.includes("OpenAI") ||
    msg.includes("enough text") ||
    msg.includes("Could not read")
  ) {
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return hostApiError(err);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
    }

    const instructions = normalizeImportInstructions(
      typeof form.get("instructions") === "string"
        ? String(form.get("instructions"))
        : null,
    );

    let documentText: string;
    try {
      documentText = await extractTextFromUpload(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read document.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (event: TripImportProgress) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          await importTripFromDocumentText({
            tripId: trip.id,
            text: documentText,
            defaultTimezone: trip.timezone,
            instructions,
            preserveTripName: trip.name,
            onProgress: send,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Import failed.";
          send({ type: "error", error: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return importErrorResponse(err);
  }
}
