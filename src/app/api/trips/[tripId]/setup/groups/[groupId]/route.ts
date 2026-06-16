import { NextResponse } from "next/server";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { DeleteTripGroupError, deleteTripGroup } from "@/lib/groups/delete-trip-group";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ tripId: string; groupId: string }> },
) {
  const { tripId, groupId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    await deleteTripGroup(tripId, groupId);
    await maybeAutoPublish(tripId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DeleteTripGroupError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return hostApiError(err);
  }
}
