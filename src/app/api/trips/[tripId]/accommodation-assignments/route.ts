import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { accommodationAssignments } from "@/lib/db/schema";
import {
  loadAccommodationAssignments,
  validateAssignmentTargets,
  validateStayForTrip,
} from "@/lib/host/accommodation-assignment-queries";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const CreateAssignmentSchema = z.object({
  stayId: z.string().uuid(),
  participantId: z.string().uuid().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const assignments = await loadAccommodationAssignments(tripId);
    return NextResponse.json({ assignments });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const parsed = CreateAssignmentSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    await validateStayForTrip(tripId, parsed.data.stayId);
    await validateAssignmentTargets(tripId, parsed.data);

    const [created] = await db
      .insert(accommodationAssignments)
      .values({
        stayId: parsed.data.stayId,
        participantId: parsed.data.participantId ?? null,
        groupId: parsed.data.groupId ?? null,
        roomId: parsed.data.roomId ?? null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      })
      .returning();

    await maybeAutoPublish(tripId);
    return NextResponse.json(created);
  } catch (err) {
    return hostApiError(err);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("id");
    if (!assignmentId) {
      return NextResponse.json({ error: "Assignment id required." }, { status: 400 });
    }

    const existing = await loadAccommodationAssignments(tripId);
    if (!existing.some((a) => a.id === assignmentId)) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    await db.delete(accommodationAssignments).where(eq(accommodationAssignments.id, assignmentId));
    await maybeAutoPublish(tripId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
