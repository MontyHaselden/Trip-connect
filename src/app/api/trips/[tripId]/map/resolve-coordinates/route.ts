import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import {
  buildSetupEngineResponse,
  loadTripGraph,
  persistCommands,
  serializeSetupResponse,
} from "@/lib/trip-engine";
import { loadCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/index";
import { loadRosterSummary } from "@/lib/trip-engine/roster-summary";
import { buildMapCoordinateResolveCommands } from "@/lib/trip-engine/resolve-map-coordinates";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => ({}));
    const groupId = typeof json?.groupId === "string" ? json.groupId : undefined;

    const graph = await loadTripGraph(tripId);
    if (!graph) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const effectiveGroupId = groupId ?? graph.mainGroupId;
    const { commands, results } = await buildMapCoordinateResolveCommands(graph, effectiveGroupId);

    if (!commands.length) {
      return NextResponse.json({
        resolved: 0,
        failed: results.filter((row) => row.status === "failed").length,
        skipped: results.filter((row) => row.status === "skipped").length,
        results,
      });
    }

    const persistResult = await persistCommands(tripId, graph, commands);
    const [rosterSummary, costLedger] = await Promise.all([
      loadRosterSummary(tripId),
      loadCostLedgerProjection(tripId, persistResult.graph).catch(() => null),
    ]);

    const response = buildSetupEngineResponse(persistResult.graph, {
      groupId: effectiveGroupId,
      inviteCode: trip.inviteCode,
      rosterSummary,
      costLedger,
    });

    return NextResponse.json({
      resolved: results.filter((row) => row.status === "resolved").length,
      failed: results.filter((row) => row.status === "failed").length,
      skipped: results.filter((row) => row.status === "skipped").length,
      results,
      warnings: persistResult.warnings,
      conflicts: persistResult.conflicts ?? [],
      ...serializeSetupResponse(response),
    });
  } catch (err) {
    return hostApiError(err);
  }
}
