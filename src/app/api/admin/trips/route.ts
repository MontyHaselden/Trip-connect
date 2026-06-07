import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminRole } from "@/lib/admin/permissions";
import { db } from "@/lib/db/client";
import { hostAccounts, hostTripMembers, trips } from "@/lib/db/schema";
import { isTripCompleted } from "@/lib/host/trip-delete-eligibility";

export async function GET() {
  try {
    await requireAdminRole("support");

    const rows = await db
      .select({
        trip: trips,
        hostId: hostTripMembers.hostId,
        accountEmail: hostAccounts.email,
        accountName: hostAccounts.fullName,
        schoolName: hostAccounts.schoolName,
      })
      .from(trips)
      .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
      .innerJoin(hostAccounts, eq(hostAccounts.id, hostTripMembers.hostId))
      .orderBy(desc(trips.createdAt))
      .limit(300);

    const tripList = rows.map((r) => ({
      id: r.trip.id,
      name: r.trip.name,
      schoolName: r.trip.schoolName,
      startDate: r.trip.startDate,
      endDate: r.trip.endDate,
      publishedVersion: r.trip.publishedVersion,
      accountId: r.hostId,
      accountEmail: r.accountEmail,
      accountName: r.accountName,
      accountSchool: r.schoolName,
      completed: isTripCompleted(r.trip),
      archivedAt: r.trip.archivedAt?.toISOString() ?? null,
    }));

    return NextResponse.json({ trips: tripList });
  } catch (err) {
    return adminApiError(err);
  }
}
