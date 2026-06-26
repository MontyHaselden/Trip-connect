import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { calendarGridFromToday } from "@/lib/host/setup/calendar-bounds";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { loadTripGraph } from "@/lib/trip-engine";
import {
  graphPayloadStats,
  slimGraphPayloadForEngine,
} from "@/lib/trip-engine/slim-graph-payload";
import { enumerateDates, MAX_DATE_ENUMERATION_DAYS } from "@/lib/host/wizard/location-stays";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const t0 = performance.now();
    const graph = await loadTripGraph(tripId);
    const loadMs = performance.now() - t0;
    if (!graph) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const rawStats = graphPayloadStats(graph);
    const slimmed = slimGraphPayloadForEngine(graph);
    const slimStats = graphPayloadStats(slimmed);
    const bounds = effectiveTripBoundsFromState(graph);
    const grid = calendarGridFromToday({
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      timezone: graph.basics.timezone,
      dayPlaces: graph.dayPlacesByGroupId[graph.mainGroupId],
      accommodationStays: graph.accommodationStays,
    });
    const gridDays = enumerateDates(grid.gridStart, grid.gridEnd);

    const issues: string[] = [];
    if (rawStats.estimatedJsonBytes > 5_000_000) {
      issues.push(`Payload ${(rawStats.estimatedJsonBytes / 1e6).toFixed(1)}MB — browser parse will freeze`);
    }
    if (rawStats.dayPlaceRows > 5_000) {
      issues.push(`${rawStats.dayPlaceRows} day-place DB rows — likely corrupt bulk paint`);
    }
    if (rawStats.dayPlaceRows > slimStats.dayPlaceRows * 1.5) {
      issues.push(
        `Slimming drops ${rawStats.dayPlaceRows - slimStats.dayPlaceRows} off-grid day-place rows`,
      );
    }
    if (gridDays.length >= MAX_DATE_ENUMERATION_DAYS) {
      issues.push("Calendar grid hits enumerateDates cap — corrupt trip dates");
    }

    return NextResponse.json({
      tripId,
      loadMs: Math.round(loadMs),
      basics: graph.basics,
      bounds,
      grid: { ...grid, dayCount: gridDays.length, capped: gridDays.length >= MAX_DATE_ENUMERATION_DAYS },
      raw: rawStats,
      slim: slimStats,
      issues,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
