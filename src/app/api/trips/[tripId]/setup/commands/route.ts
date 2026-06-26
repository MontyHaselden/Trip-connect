import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import {
  buildSetupEngineResponse,
  isCalendarLabelsOnlyBatch,
  loadTripGraph,
  persistCommands,
  serializeSetupResponse,
} from "@/lib/trip-engine";
import { loadCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/index";
import { loadRosterSummary } from "@/lib/trip-engine/roster-summary";
import type { TripCommand } from "@/lib/trip-engine/commands";

function isActivityOnlyCommands(commands: TripCommand[]): boolean {
  return (
    commands.length > 0 &&
    commands.every((c) =>
      ["addActivity", "updateActivity", "removeActivity"].includes(c.type),
    )
  );
}

function isAccommodationOnlyCommands(commands: TripCommand[]): boolean {
  return (
    commands.length > 0 &&
    commands.every((c) =>
      [
        "addStay",
        "updateStay",
        "removeStay",
        "paintDayRange",
        "setDayPlaces",
        "clearDayRange",
      ].includes(c.type),
    )
  );
}

function isAccommodationStayMutation(commands: TripCommand[]): boolean {
  return commands.some((c) =>
    c.type === "addStay" || c.type === "updateStay" || c.type === "removeStay",
  );
}

function commandsNeedCostRefresh(commands: TripCommand[]): boolean {
  return commands.some((c) =>
    [
      "removeStay",
      "updateStay",
      "removeTransportLeg",
      "removeActivity",
      "addStay",
      "addTransportLeg",
      "addClassifiedTransportLegs",
      "addTransportProduct",
      "updateTransportProduct",
      "removeTransportProduct",
      "addActivity",
      "ensurePersonalGroup",
      "setGroupInheritMode",
    ].includes(c.type),
  );
}

async function handleCommands(
  tripId: string,
  commands: TripCommand[],
  groupId?: string,
  inviteCode?: string,
) {
  const graph = await loadTripGraph(tripId);
  if (!graph) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const result = await persistCommands(tripId, graph, commands);
  const syncOnly = isCalendarLabelsOnlyBatch(commands);
  const lightweight =
    syncOnly ||
    (isAccommodationOnlyCommands(commands) &&
      !isAccommodationStayMutation(commands) &&
      !commandsNeedCostRefresh(commands));
  const [rosterSummary, costLedger] = lightweight
    ? [undefined, undefined]
    : await Promise.all([
        loadRosterSummary(tripId),
        loadCostLedgerProjection(tripId, result.graph).catch(() => null),
      ]);

  if (syncOnly) {
    return NextResponse.json({
      syncOnly: true,
      warnings: result.warnings,
      conflicts: result.conflicts ?? [],
    });
  }

  if (isActivityOnlyCommands(commands)) {
    return NextResponse.json({
      activitySync: true,
      warnings: result.warnings,
      conflicts: result.conflicts ?? [],
      costLedger,
    });
  }

  const response = buildSetupEngineResponse(result.graph, {
    groupId: groupId ?? graph.mainGroupId,
    inviteCode,
    rosterSummary,
    costLedger,
  });

  return NextResponse.json(
    serializeSetupResponse({
      ...response,
      warnings: [...response.warnings, ...result.warnings],
      conflicts: [...response.conflicts, ...result.conflicts],
    }),
  );
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
    const commands = json?.commands as TripCommand[] | undefined;
    const groupId = json?.groupId as string | undefined;

    if (!commands?.length) {
      return NextResponse.json({ error: "No commands provided." }, { status: 400 });
    }

    return await handleCommands(tripId, commands, groupId, trip.inviteCode);
  } catch (err) {
    return hostApiError(err);
  }
}

/** @deprecated use PATCH */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  return PATCH(req, ctx);
}
