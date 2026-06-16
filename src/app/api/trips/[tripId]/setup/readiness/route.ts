import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { checkReadiness } from "@/lib/trip-engine/readiness-checker";
import { loadTripEntityGraph } from "@/lib/trip-engine/load-graph";
import { buildSnapshotV1 } from "@/lib/publish/build-snapshot";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const graph = await loadTripEntityGraph(tripId);
    if (!graph) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const snapshot = await buildSnapshotV1(tripId, trip.publishedVersion || 1);
    const sections = await checkReadiness(graph, snapshot);

    return NextResponse.json({ sections });
  } catch (err) {
    return hostApiError(err);
  }
}
