import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { deleteTripForHost } from "@/lib/host/delete-trip";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { getTripDeleteStatus, loadItineraryBuildStats } from "@/lib/host/trip-delete-eligibility";
import { getTripLifecycleForTrip, TRIP_STATUS_LABELS } from "@/lib/host/trip-lifecycle";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const deleteStatus = await getTripDeleteStatus({
      id: trip.id,
      startDate: trip.startDate,
      endDate: trip.endDate,
      timezone: trip.timezone,
      publishedVersion: trip.publishedVersion,
    });

    const stats = await loadItineraryBuildStats(trip.id);
    const lifecycle = await getTripLifecycleForTrip(
      {
        id: trip.id,
        setupMethod: trip.setupMethod,
        startDate: trip.startDate,
        endDate: trip.endDate,
        timezone: trip.timezone,
      },
      stats,
    );

    return NextResponse.json({
      trip,
      deleteStatus,
      lifecycle: {
        ...lifecycle,
        statusLabel: TRIP_STATUS_LABELS[lifecycle.status],
      },
    });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const result = await deleteTripForHost(hostId, tripId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
