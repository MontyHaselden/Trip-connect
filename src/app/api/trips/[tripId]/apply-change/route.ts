import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { aiChangeProposals, itineraryItems, tripDays } from "@/lib/db/schema";
import type { ProposedChange } from "@/lib/ai/mock-chat";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { nextDaySortOrder, nextItemSortOrder } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";

const BodySchema = z.object({
  proposalId: z.string().uuid(),
});

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
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const proposal = await db
      .select()
      .from(aiChangeProposals)
      .where(
        and(
          eq(aiChangeProposals.id, parsed.data.proposalId),
          eq(aiChangeProposals.tripId, tripId),
          eq(aiChangeProposals.status, "draft"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }

    const changes = proposal.proposedChangesJson as ProposedChange[];
    let applied = 0;

    for (const change of changes) {
      if (change.type === "add_day") {
        const sortOrder = await nextDaySortOrder(tripId);
        const date = new Date().toISOString().slice(0, 10);
        await db.insert(tripDays).values({
          tripId,
          date,
          cityLabel: String(change.payload.cityLabel ?? "City"),
          calendarLabel: change.payload.calendarLabel
            ? String(change.payload.calendarLabel)
            : null,
          sortOrder,
        });
        applied++;
      }
      if (change.type === "add_item") {
        const day = await db
          .select({ id: tripDays.id })
          .from(tripDays)
          .where(eq(tripDays.tripId, tripId))
          .orderBy(tripDays.sortOrder)
          .limit(1)
          .then((rows) => rows[0]);
        if (day) {
          const sortOrder = await nextItemSortOrder(day.id);
          await db.insert(itineraryItems).values({
            tripId,
            tripDayId: day.id,
            startTime: String(change.payload.startTime ?? "09:00:00"),
            endTime: null,
            title: String(change.payload.title ?? "Activity"),
            locationName: null,
            address: null,
            mapQuery: null,
            leaveByTime: null,
            transportNote: null,
            bringNote: null,
            hostNote: null,
            audienceType: "everyone",
            audienceId: null,
            category: (change.payload.category as "meeting" | "activity" | null) ?? null,
            sortOrder,
          });
          applied++;
        }
      }
      if (change.type === "update_item") {
        const titleMatch = String(change.payload.titleMatch ?? "").toLowerCase();
        const items = await db
          .select()
          .from(itineraryItems)
          .where(eq(itineraryItems.tripId, tripId));
        const target = items.find((i) => i.title.toLowerCase().includes(titleMatch));
        if (target && change.payload.startTime) {
          await db
            .update(itineraryItems)
            .set({ startTime: String(change.payload.startTime) })
            .where(eq(itineraryItems.id, target.id));
          applied++;
        }
      }
    }

    await db
      .update(aiChangeProposals)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(aiChangeProposals.id, proposal.id));

    await maybeAutoPublish(tripId);

    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    return hostApiError(err);
  }
}
