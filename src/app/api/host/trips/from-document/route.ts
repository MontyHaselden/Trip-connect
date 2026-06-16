import { after, NextResponse } from "next/server";

import { requireHostSessionHostId, setHostSessionCookie } from "@/lib/auth/host-session";
import { normalizeImportInstructions } from "@/lib/documents/document-import-instructions";
import { extractTextFromUpload } from "@/lib/documents/extract-text";
import { extractTripMetadataQuick } from "@/lib/documents/extract-trip-metadata";
import { tripHomeDefaultsFromAccount } from "@/lib/host/account-home";
import { getHostAccountById } from "@/lib/host/auth";
import { hostApiError } from "@/lib/host/api-errors";
import { importTripFromDocumentText } from "@/lib/host/import-trip-from-document";
import { createTripForHost } from "@/lib/host/trip-create";

export const runtime = "nodejs";
export const maxDuration = 300;

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

    const metadata = extractTripMetadataQuick(documentText, defaultTimezone);

    const host = await getHostAccountById(hostId);
    const homeDefaults = host
      ? tripHomeDefaultsFromAccount({
          homeCity: host.homeCity ?? "",
          defaultAirport: host.defaultAirport ?? "",
          schoolName: host.schoolName,
        })
      : null;

    const trip = await createTripForHost({
      hostId,
      name: metadata.name,
      schoolName: homeDefaults?.schoolName ?? metadata.schoolName,
      startDate: metadata.startDate,
      endDate: metadata.endDate,
      timezone: metadata.timezone,
      defaultCountryCallingCode,
      departureCity: homeDefaults?.departureCity,
      returnCity: homeDefaults?.returnCity,
      defaultDepartureAirport: homeDefaults?.defaultDepartureAirport,
    });

    await setHostSessionCookie({ hostId, activeTripId: trip.id });

    after(async () => {
      try {
        await importTripFromDocumentText({
          tripId: trip.id,
          text: documentText,
          defaultTimezone,
          instructions,
        });
      } catch (err) {
        console.error("[from-document] background import failed:", err);
      }
    });

    return NextResponse.json({
      ok: true,
      building: true,
      tripId: trip.id,
      inviteCode: trip.inviteCode,
      trip: metadata,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
