import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { trips } from "@/lib/db/schema";
import {
  absoluteMobileUrl,
  createMobileAccessToken,
  rotateMobileAccessToken,
} from "@/lib/mobile/tokens";

export async function ensureHostAdminMobileLink(params: {
  tripId: string;
  hostId: string;
  origin: string;
  rotate?: boolean;
}) {
  const token = params.rotate
    ? await rotateMobileAccessToken({
        tripId: params.tripId,
        hostId: params.hostId,
        purpose: "host_admin",
      })
    : await createMobileAccessToken({
        tripId: params.tripId,
        hostId: params.hostId,
        purpose: "host_admin",
      });

  const path = `/mobile/admin/${token}`;
  return { url: absoluteMobileUrl(params.origin, path), token, path };
}

export async function createPublishMobileLinks(params: {
  tripId: string;
  hostId: string;
  inviteCode: string;
  origin: string;
}) {
  const hostTripToken = await rotateMobileAccessToken({
    tripId: params.tripId,
    hostId: params.hostId,
    purpose: "host_trip",
  });

  const hostTripPath = `/mobile/trip/host/${hostTripToken}`;
  const studentPath = `/s/${params.inviteCode}`;

  return {
    hostTrip: {
      url: absoluteMobileUrl(params.origin, hostTripPath),
      path: hostTripPath,
    },
    studentInvite: {
      url: absoluteMobileUrl(params.origin, studentPath),
      path: studentPath,
    },
  };
}

export async function getTripName(tripId: string) {
  const row = await db
    .select({ name: trips.name, inviteCode: trips.inviteCode })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row;
}
