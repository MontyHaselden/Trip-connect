import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { reconcileTripShellState } from "@/lib/host/setup/reconcile-trip-shell";
import { graphToSetupState, setupStateToGraph } from "@/lib/trip-engine/adapters";
import { syncActivitiesForTrip } from "@/lib/trip-engine/activities-persistence";
import {
  buildSetupEngineResponse,
  loadTripGraph,
  serializeSetupResponse,
} from "@/lib/trip-engine";
import { loadCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/index";
import { loadRosterSummary } from "@/lib/trip-engine/roster-summary";
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

    const loaded = await loadTripGraph(tripId);
    if (!loaded) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const graph = setupStateToGraph(tripId, reconcileTripShellState(graphToSetupState(loaded)));
    const shellChanged =
      graph.basics.startDate !== loaded.basics.startDate ||
      graph.basics.endDate !== loaded.basics.endDate ||
      JSON.stringify(graph.dayPlacesByGroupId[graph.mainGroupId] ?? []) !==
        JSON.stringify(loaded.dayPlacesByGroupId[graph.mainGroupId] ?? []);

    if (shellChanged) {
      await applyTripSetupState(tripId, graphToSetupState(graph), {
        activeGroupId: graph.mainGroupId,
        skipWizardItineraryItems: true,
      });
    }

    const url = new URL(req.url);
    const engine = url.searchParams.get("engine") === "1";
    const groupId = url.searchParams.get("groupId") ?? graph.mainGroupId;

    if (engine) {
      const [rosterSummary, costLedger] = await Promise.all([
        loadRosterSummary(tripId),
        loadCostLedgerProjection(tripId, graph).catch(() => null),
      ]);
      const response = buildSetupEngineResponse(graph, {
        groupId,
        inviteCode: trip.inviteCode,
        rosterSummary,
        costLedger,
      });
      return NextResponse.json(serializeSetupResponse(response));
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
