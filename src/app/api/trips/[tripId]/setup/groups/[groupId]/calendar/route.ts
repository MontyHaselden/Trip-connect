import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { loadTripSetupState } from "@/lib/host/setup/load-setup-state";

const DaySchema = z.object({
  date: z.string(),
  primaryCity: z.string(),
  secondaryCity: z.string().nullable(),
  primaryShare: z.number(),
  dayType: z.string(),
  includeBuffer: z.boolean().optional(),
});

const PatchSchema = z.object({
  days: z.array(DaySchema),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string; groupId: string }> },
) {
  const { tripId, groupId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const state = await loadTripSetupState(tripId);
    if (!state) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const days = state.dayPlacesByGroupId[groupId] ?? [];
    return NextResponse.json({ groupId, days });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string; groupId: string }> },
) {
  const { tripId, groupId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const state = await loadTripSetupState(tripId);
    if (!state) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid calendar data." }, { status: 400 });
    }

    const nextState = {
      ...state,
      dayPlacesByGroupId: {
        ...state.dayPlacesByGroupId,
        [groupId]: parsed.data.days.map((d) => ({
          ...d,
          includeBuffer: d.includeBuffer ?? false,
          dayType: d.dayType as (typeof state.dayPlacesByGroupId)[string][number]["dayType"],
        })),
      },
    };

    const result = await applyTripSetupState(tripId, nextState, { activeGroupId: groupId });
    return NextResponse.json({ ok: true, dayCount: result.dayCount });
  } catch (err) {
    return hostApiError(err);
  }
}
