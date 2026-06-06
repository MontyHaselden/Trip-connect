import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { normalizeImportInstructions } from "@/lib/documents/document-import-instructions";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { importTripFromDocumentText } from "@/lib/host/import-trip-from-document";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    const result = await importTripFromDocumentText({
      tripId: trip.id,
      text: documentText,
      defaultTimezone: trip.timezone,
      instructions,
      preserveTripName: trip.name,
    });

    return NextResponse.json({
      ok: true,
      stats: result.stats,
      trip: result.trip,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed.";
    if (msg.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return hostApiError(err);
  }
}
