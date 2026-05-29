import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { publishedTripSnapshots, trips } from "@/lib/db/schema";
import {
  requireHostTripEditAccess,
  requireHostTripForInvite,
  type HostTrip,
} from "@/lib/auth/require-host-trip";
import { maybeAutoPublish } from "@/lib/publish/maybe-auto-publish";
import { tripNeedsPublishConfirm } from "@/lib/publish/trip-live";

const PatchTripSchema = z.object({
  name: z.string().trim().min(1).max(200),
  schoolName: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  destinationCountry: z.string().trim().max(100).nullable(),
  destinationLanguage: z.string().trim().max(20).nullable(),
  timezone: z.string().trim().min(1).max(80),
  defaultCountryCallingCode: z.string().trim().min(2).max(2),
});

async function getLastPublishedAt(tripId: string, version: number) {
  if (version === 0) return null;
  const row = await db
    .select({ publishedAt: publishedTripSnapshots.publishedAt })
    .from(publishedTripSnapshots)
    .where(
      and(
        eq(publishedTripSnapshots.tripId, tripId),
        eq(publishedTripSnapshots.version, version),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (row) return row.publishedAt.toISOString();

  const latest = await db
    .select({ publishedAt: publishedTripSnapshots.publishedAt })
    .from(publishedTripSnapshots)
    .where(eq(publishedTripSnapshots.tripId, tripId))
    .orderBy(desc(publishedTripSnapshots.version))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return latest?.publishedAt.toISOString() ?? null;
}

function tripToJson(
  trip: HostTrip,
  lastPublishedAt: string | null,
  needsPublishConfirm: boolean,
) {
  return {
    id: trip.id,
    name: trip.name,
    schoolName: trip.schoolName,
    inviteCode: trip.inviteCode,
    startDate: trip.startDate,
    endDate: trip.endDate,
    destinationCountry: trip.destinationCountry,
    destinationLanguage: trip.destinationLanguage,
    timezone: trip.timezone,
    defaultCountryCallingCode: trip.defaultCountryCallingCode,
    publishedVersion: trip.publishedVersion,
    lastPublishedAt,
    needsPublishConfirm,
    updatedAt: trip.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const trip = await requireHostTripForInvite(inviteCode);
    const [lastPublishedAt, needsConfirm] = await Promise.all([
      getLastPublishedAt(trip.id, trip.publishedVersion),
      tripNeedsPublishConfirm(trip.id),
    ]);
    return NextResponse.json({
      ...tripToJson(trip, lastPublishedAt, needsConfirm),
      canEdit: trip.canEdit,
      role: trip.role,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ inviteCode: string }> },
) {
  const { inviteCode } = await ctx.params;

  try {
    const existing = await requireHostTripEditAccess(inviteCode);
    const json = await req.json().catch(() => null);
    const parsed = PatchTripSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = parsed.data;
    if (data.endDate < data.startDate) {
      return NextResponse.json(
        { error: "End date must be on or after start date." },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(trips)
      .set({
        name: data.name,
        schoolName: data.schoolName,
        startDate: data.startDate,
        endDate: data.endDate,
        destinationCountry: data.destinationCountry,
        destinationLanguage: data.destinationLanguage,
        timezone: data.timezone,
        defaultCountryCallingCode: data.defaultCountryCallingCode,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, existing.id))
      .returning({
        id: trips.id,
        name: trips.name,
        schoolName: trips.schoolName,
        inviteCode: trips.inviteCode,
        startDate: trips.startDate,
        endDate: trips.endDate,
        destinationCountry: trips.destinationCountry,
        destinationLanguage: trips.destinationLanguage,
        timezone: trips.timezone,
        defaultCountryCallingCode: trips.defaultCountryCallingCode,
        publishedVersion: trips.publishedVersion,
        updatedAt: trips.updatedAt,
      });

    if (!updated) {
      return NextResponse.json({ error: "Update failed." }, { status: 500 });
    }

    const [lastPublishedAt, needsConfirm] = await Promise.all([
      getLastPublishedAt(updated.id, updated.publishedVersion),
      tripNeedsPublishConfirm(updated.id),
    ]);

    await maybeAutoPublish(existing.id);
    return NextResponse.json({
      ...tripToJson(
        {
          ...updated,
          updatedAt: updated.updatedAt,
        },
        lastPublishedAt,
        needsConfirm,
      ),
      canEdit: existing.canEdit,
      role: existing.role,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Update failed.";
    const status = msg === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
