import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { hostTripInvites, hostTripMembers } from "@/lib/db/schema";

export async function acceptPendingInvitesForEmail(email: string, hostId: string) {
  const normalized = email.trim().toLowerCase();
  const now = new Date();

  const pending = await db
    .select({
      tripId: hostTripInvites.tripId,
      canEdit: hostTripInvites.canEdit,
    })
    .from(hostTripInvites)
    .where(sql`lower(${hostTripInvites.invitedEmail}) = ${normalized}`);

  for (const invite of pending) {
    const exists = await db
      .select({ hostId: hostTripMembers.hostId })
      .from(hostTripMembers)
      .where(
        and(
          eq(hostTripMembers.tripId, invite.tripId),
          eq(hostTripMembers.hostId, hostId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (!exists) {
      await db.insert(hostTripMembers).values({
        hostId,
        tripId: invite.tripId,
        canEdit: invite.canEdit,
        acceptedAt: now,
      });
    }
  }

  await db
    .delete(hostTripInvites)
    .where(sql`lower(${hostTripInvites.invitedEmail}) = ${normalized}`);
}
