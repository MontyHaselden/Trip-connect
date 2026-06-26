import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { graphToSetupState } from "@/lib/trip-engine/adapters";
import { syncActivitiesForTrip } from "@/lib/trip-engine/activities-persistence";
import { loadTripGraph } from "@/lib/trip-engine";
import { loadRosterSummary } from "@/lib/trip-engine/roster-summary";
import {
  graphPayloadStats,
  slimGraphPayloadForEngine,
} from "@/lib/trip-engine/slim-graph-payload";
import type { TripSetupState } from "@/lib/host/setup/types";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const graph = await loadTripGraph(tripId);
    if (!graph) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const url = new URL(req.url);
    const engine = url.searchParams.get("engine") === "1";
    const groupId = url.searchParams.get("groupId") ?? graph.mainGroupId;

    if (engine) {
      const rosterSummary = await loadRosterSummary(tripId);
      const rawStats = graphPayloadStats(graph);
      const slimGraph = slimGraphPayloadForEngine(graph);
      const slimStats = graphPayloadStats(slimGraph);
      return NextResponse.json({
        graph: slimGraph,
        inviteCode: trip.inviteCode,
        rosterSummary,
        warnings: [],
        conflicts: [],
        readiness: [],
        meta: {
          ...slimStats,
          rawDayPlaceRows: rawStats.dayPlaceRows,
          dayPlacesDropped: rawStats.dayPlaceRows - slimStats.dayPlaceRows,
        },
      });
    }

    return NextResponse.json({ state: graphToSetupState(graph), inviteCode: trip.inviteCode });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const state = json?.state;
    const activeGroupId = json?.activeGroupId as string | undefined;
    const skipWizardItineraryItems = json?.skipWizardItineraryItems === true;
    if (!state) {
      return NextResponse.json({ error: "Invalid setup data." }, { status: 400 });
    }

    const result = await applyTripSetupState(tripId, state as TripSetupState, {
      activeGroupId,
      skipWizardItineraryItems,
    });
    if (Array.isArray(state.activities)) {
      await syncActivitiesForTrip(tripId, state.activities);
    }
    return NextResponse.json({ ok: true, dayCount: result.dayCount });
  } catch (err) {
    return hostApiError(err);
  }
}
