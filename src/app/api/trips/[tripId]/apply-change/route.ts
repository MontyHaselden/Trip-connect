import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import {
  findItemsForUpdate,
  itemValuesFromPayload,
  resolveItemDayId,
} from "@/lib/ai/apply-proposed-change";
import type { ProposedChange } from "@/lib/ai/mock-chat";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { nextDaySortOrder, nextItemSortOrder } from "@/lib/host/itinerary-queries";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import { syncTripDatesFromDays } from "@/lib/host/trip-dates";
import { aiChangeProposals, itineraryItems, tripDays, trips } from "@/lib/db/schema";

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
      if (change.type === "update_trip_dates") {
        const startDate = String(change.payload.startDate ?? "");
        const endDate = String(change.payload.endDate ?? "");
        if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
          if (endDate >= startDate) {
            await db
              .update(trips)
              .set({ startDate, endDate, updatedAt: new Date() })
              .where(eq(trips.id, tripId));
            applied++;
          }
        }
      }
      if (change.type === "add_day") {
        const sortOrder = await nextDaySortOrder(tripId);
        const date =
          typeof change.payload.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(change.payload.date)
            ? change.payload.date
            : new Date().toISOString().slice(0, 10);
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
        const dayId = await resolveItemDayId(tripId, change.payload);
        if (dayId) {
          const sortOrder = await nextItemSortOrder(dayId);
          await db.insert(itineraryItems).values(
            itemValuesFromPayload(tripId, dayId, sortOrder, change.payload),
          );
          applied++;
        }
      }
      if (change.type === "update_item") {
        const titleMatch = String(change.payload.titleMatch ?? "").toLowerCase();
        const date =
          typeof change.payload.date === "string" ? change.payload.date : null;
        const targets = await findItemsForUpdate(tripId, titleMatch, date);
        const target = targets[0];
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

    await syncTripDatesFromDays(tripId);
    await maybeAutoPublish(tripId);

    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    return hostApiError(err);
  }
}
