import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostTripEditAccess } from "@/lib/auth/require-host-trip";
import { applyItineraryImport } from "@/lib/ai/apply-itinerary-import";
import { parseItineraryText } from "@/lib/ai/itinerary-import";
import { hostApiError } from "@/lib/host/api-errors";
import { loadItineraryTree } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import { tripNeedsPublishConfirm } from "@/lib/publish/trip-live";

const ImportBodySchema = z.object({
  text: z.string().trim().min(20).max(12_000),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;
  try {
    const trip = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = ImportBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let importData;
    try {
      importData = await parseItineraryText({
        text: parsed.data.text,
        trip: {
          name: trip.name,
          startDate: trip.startDate,
          endDate: trip.endDate,
          timezone: trip.timezone,
          destinationCountry: trip.destinationCountry,
          destinationLanguage: trip.destinationLanguage,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed.";
      if (msg.includes("OPENAI_API_KEY")) {
        return NextResponse.json({ error: msg }, { status: 503 });
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const stats = await applyItineraryImport(trip.id, importData);
    await maybeAutoPublish(trip.id);
    const tree = await loadItineraryTree(trip.id);
    const needsPublishConfirm = await tripNeedsPublishConfirm(trip.id);

    return NextResponse.json({
      stats,
      needsPublishConfirm,
      ...tree,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
