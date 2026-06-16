import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import { entityBookingDetails } from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";

const EntityTypeSchema = z.enum([
  "itinerary_item",
  "transport_leg",
  "accommodation_stay",
]);

const BookingSchema = z.object({
  bookingStatus: z
    .enum(["booked", "flexible", "placeholder", "not_booked", "cancelled"])
    .optional(),
  supplier: z.string().nullable().optional(),
  bookingReference: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceFileUrl: z.string().nullable().optional(),
  confirmationFileUrl: z.string().nullable().optional(),
  amountCents: z.number().int().nullable().optional(),
  currency: z.string().nullable().optional(),
  paymentStatus: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  externalRouteId: z.string().nullable().optional(),
  routeStatus: z.string().nullable().optional(),
  routeWarning: z.string().nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string; entityType: string; entityId: string }> },
) {
  const { tripId, entityType, entityId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const et = EntityTypeSchema.parse(entityType);
    const row = await db
      .select()
      .from(entityBookingDetails)
      .where(
        and(
          eq(entityBookingDetails.tripId, tripId),
          eq(entityBookingDetails.entityType, et),
          eq(entityBookingDetails.entityId, entityId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    return NextResponse.json({ booking: row });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string; entityType: string; entityId: string }> },
) {
  const { tripId, entityType, entityId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const et = EntityTypeSchema.parse(entityType);
    const json = await req.json().catch(() => null);
    const parsed = BookingSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid booking data." }, { status: 400 });
    }

    const existing = await db
      .select({ id: entityBookingDetails.id })
      .from(entityBookingDetails)
      .where(
        and(
          eq(entityBookingDetails.entityType, et),
          eq(entityBookingDetails.entityId, entityId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const values = { ...parsed.data, updatedAt: new Date() };

    if (existing) {
      await db
        .update(entityBookingDetails)
        .set(values)
        .where(eq(entityBookingDetails.id, existing.id));
    } else {
      await db.insert(entityBookingDetails).values({
        tripId,
        entityType: et,
        entityId,
        bookingStatus: parsed.data.bookingStatus ?? "not_booked",
        ...values,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return hostApiError(err);
  }
}
