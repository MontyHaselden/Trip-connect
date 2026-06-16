import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { propagateEntityChange } from "@/lib/groups/propagate-change";

const BodySchema = z.object({
  entityType: z.enum(["itinerary_item", "transport_leg", "accommodation_stay"]),
  scope: z.enum(["main_only", "all_groups", "selected_groups"]),
  selectedGroupIds: z.array(z.string().uuid()).optional(),
  patch: z.record(z.string(), z.union([z.string(), z.null()])),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string; entityId: string }> },
) {
  const { tripId, entityId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid propagate request." }, { status: 400 });
    }

    const result = await propagateEntityChange({
      tripId,
      entityType: parsed.data.entityType,
      baseEntityId: entityId,
      patch: parsed.data.patch,
      scope: parsed.data.scope,
      selectedGroupIds: parsed.data.selectedGroupIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    return hostApiError(err);
  }
}
