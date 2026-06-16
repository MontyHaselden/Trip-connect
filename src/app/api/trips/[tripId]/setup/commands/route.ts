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
import type { TripCommand } from "@/lib/trip-engine/commands";

async function handleCommands(
  tripId: string,
  commands: TripCommand[],
  groupId?: string,
) {
  const graph = await loadTripGraph(tripId);
  if (!graph) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

  const result = await persistCommands(tripId, graph, commands);
  const response = buildSetupEngineResponse(result.graph, {
    groupId: groupId ?? graph.mainGroupId,
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

    return await handleCommands(tripId, commands, groupId);
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
