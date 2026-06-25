import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { hostAccounts, hostTripMembers, trips } from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { requireHostSessionHostId, setHostSessionCookie } from "@/lib/auth/host-session";
import { getHostAccountById } from "@/lib/host/auth";
import { createTripShell } from "@/lib/host/create-trip-with-document";
import { getActiveTripCountForAccount } from "@/lib/plans/account-usage";
import { enforceActiveTripLimit } from "@/lib/plans/enforce-plan";
import {
  loadItineraryBuildStatsForTrips,
  resolveTripDeleteStatus,
} from "@/lib/host/trip-delete-eligibility";
import {
  loadWizardMetaForTrips,
  resolveTripLifecycle,
  TRIP_STATUS_LABELS,
} from "@/lib/host/trip-lifecycle";

export const runtime = "nodejs";

const CreateJsonSchema = z.object({
  name: z.string().trim().min(2).max(200),
});

function parseCreateName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 2 ? name : null;
}

export async function GET() {
  try {
    const hostId = await requireHostSessionHostId();
    const rows = await db
      .select({
        id: trips.id,
        inviteCode: trips.inviteCode,
        name: trips.name,
        schoolName: trips.schoolName,
        startDate: trips.startDate,
        endDate: trips.endDate,
        timezone: trips.timezone,
        publishedVersion: trips.publishedVersion,
        setupMethod: trips.setupMethod,
      })
      .from(trips)
      .innerJoin(hostTripMembers, eq(hostTripMembers.tripId, trips.id))
      .where(eq(hostTripMembers.hostId, hostId));

    const tripIds = rows.map((row) => row.id);
    const statsByTrip = await loadItineraryBuildStatsForTrips(tripIds);
    const wizardByTrip = await loadWizardMetaForTrips(tripIds);

    const tripsWithDelete = rows.map((row) => {
      const stats = statsByTrip.get(row.id) ?? {
        dayCount: 0,
        itemCount: 0,
        allDaysHaveItems: false,
      };
      const deleteStatus = resolveTripDeleteStatus(row, stats);
      const lifecycle = resolveTripLifecycle(row, wizardByTrip.get(row.id), stats);
      return {
        ...row,
        canDelete: deleteStatus.canDelete,
        deleteBlockedReason: deleteStatus.reason,
        deleteWarning: deleteStatus.deleteWarning,
        status: lifecycle.status,
        statusLabel: TRIP_STATUS_LABELS[lifecycle.status],
        wizardStep: lifecycle.wizardStep,
        continuePath: lifecycle.continuePath,
      };
    });

    return NextResponse.json({ trips: tripsWithDelete });
  } catch (err) {
    return hostApiError(err);
  }
}

/** Fast trip shell creation only — import document from the builder for live preview. */
export async function POST(req: Request) {
  try {
    const hostId = await requireHostSessionHostId();
    const contentType = req.headers.get("content-type") ?? "";

    let name: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData().catch(() => null);
      if (!form) {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
      }
      const parsedName = parseCreateName(form.get("name"));
      if (!parsedName) {
        return NextResponse.json({ error: "Enter a trip name (at least 2 characters)." }, { status: 400 });
      }
      name = parsedName;
    } else {
      const json = await req.json().catch(() => null);
      const parsed = CreateJsonSchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json({ error: "Enter a trip name (at least 2 characters)." }, { status: 400 });
      }
      name = parsed.data.name;
    }

    const account = await getHostAccountById(hostId);
    if (!account) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const hostRow = await db
      .select({ pausedAt: hostAccounts.pausedAt })
      .from(hostAccounts)
      .where(eq(hostAccounts.id, hostId))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (hostRow?.pausedAt) {
      return NextResponse.json({ error: "This account is paused. Contact support." }, { status: 403 });
    }

    const activeTripCount = await getActiveTripCountForAccount(hostId);
    const planCheck = await enforceActiveTripLimit({ accountId: hostId, activeTripCount });
    if (!planCheck.allowed) {
      return NextResponse.json({ error: planCheck.hardBlock ?? planCheck.softWarning }, { status: 403 });
    }

    const trip = await createTripShell({ hostId, name });
    await setHostSessionCookie({ hostId, activeTripId: trip.id });

    return NextResponse.json({
      ok: true,
      tripId: trip.id,
      inviteCode: trip.inviteCode,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
