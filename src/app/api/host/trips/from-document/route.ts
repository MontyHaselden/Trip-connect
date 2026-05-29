import { NextResponse } from "next/server";

import { requireHostSessionHostId, setHostSessionCookie } from "@/lib/auth/host-session";
import { applyItineraryImport } from "@/lib/ai/apply-itinerary-import";
import { parseTripFromDocument } from "@/lib/ai/parse-trip-document";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { hostApiError } from "@/lib/host/api-errors";
import { createTripForHost } from "@/lib/host/trip-create";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const hostId = await requireHostSessionHostId();
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose a document to upload." }, { status: 400 });
    }

    const defaultCountryCallingCode =
      typeof form.get("defaultCountryCallingCode") === "string"
        ? String(form.get("defaultCountryCallingCode")).trim().toUpperCase()
        : "NZ";

    if (defaultCountryCallingCode.length !== 2) {
      return NextResponse.json({ error: "Invalid default phone region." }, { status: 400 });
    }

    const defaultTimezone =
      typeof form.get("timezone") === "string" && String(form.get("timezone")).trim()
        ? String(form.get("timezone")).trim()
        : "UTC";

    let documentText: string;
    try {
      documentText = await extractTextFromUpload(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read document.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let parsed;
    try {
      parsed = await parseTripFromDocument({
        text: documentText,
        defaultTimezone,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI import failed.";
      if (msg.includes("OPENAI_API_KEY")) {
        return NextResponse.json({ error: msg }, { status: 503 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const trip = await createTripForHost({
      hostId,
      name: parsed.name,
      schoolName: parsed.schoolName,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      timezone: parsed.timezone,
      defaultCountryCallingCode,
      destinationCountry: parsed.destinationCountry ?? null,
      destinationLanguage: parsed.destinationLanguage ?? null,
    });

    const stats = await applyItineraryImport(trip.id, { days: parsed.days });
    await maybeAutoPublish(trip.id);

    await setHostSessionCookie({ hostId, activeTripId: trip.id });

    return NextResponse.json({
      ok: true,
      tripId: trip.id,
      inviteCode: trip.inviteCode,
      stats,
      trip: {
        name: parsed.name,
        schoolName: parsed.schoolName,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        timezone: parsed.timezone,
      },
    });
  } catch (err) {
    return hostApiError(err);
  }
}
