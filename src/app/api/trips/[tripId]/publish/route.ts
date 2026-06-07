import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { createPublishMobileLinks } from "@/lib/mobile/trip-links";
import { publishTrip } from "@/lib/publish/publish-trip";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const gaps = await analyzeImportGaps(tripId);
    if (gaps.length) {
      return NextResponse.json(
        {
          error: "Resolve location and transport gaps in Locations before publishing.",
          gaps,
        },
        { status: 400 },
      );
    }

    const result = await publishTrip(tripId);
    const origin = new URL(req.url).origin;
    const links = await createPublishMobileLinks({
      tripId: trip.id,
      hostId,
      inviteCode: trip.inviteCode,
      origin,
    });

    return NextResponse.json({ ...result, links });
  } catch (err) {
    return hostApiError(err);
  }
}
