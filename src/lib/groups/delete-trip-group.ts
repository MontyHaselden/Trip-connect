import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groups,
  itineraryItems,
  tripAccommodationStays,
  tripTransportLegs,
} from "@/lib/db/schema";

export class DeleteTripGroupError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DeleteTripGroupError";
  }
}

/** Remove a non-main group and its group-scoped trip data. */
export async function deleteTripGroup(tripId: string, groupId: string): Promise<void> {
  const group = await db
    .select({ id: groups.id, isMain: groups.isMain })
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.tripId, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!group) {
    throw new DeleteTripGroupError("Group not found.", 404);
  }
  if (group.isMain) {
    throw new DeleteTripGroupError("The main group cannot be deleted.", 400);
  }

  await db
    .delete(tripTransportLegs)
    .where(
      and(eq(tripTransportLegs.tripId, tripId), eq(tripTransportLegs.originGroupId, groupId)),
    );
  await db
    .delete(tripAccommodationStays)
    .where(
      and(
        eq(tripAccommodationStays.tripId, tripId),
        eq(tripAccommodationStays.originGroupId, groupId),
      ),
    );
  await db.delete(itineraryItems).where(eq(itineraryItems.originGroupId, groupId));

  await db.delete(groups).where(eq(groups.id, groupId));
}
