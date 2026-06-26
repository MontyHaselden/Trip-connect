import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  contacts,
  emergencyPhrases,
  entityBookingDetails,
  trips,
} from "@/lib/db/schema";
import { loadTripSetupState } from "@/lib/host/setup/load-setup-state";
import { loadHiddenPendingTransportNeedKeys } from "./hidden-pending-transport";
import { setupStateToGraph } from "./adapters";
import { repairTransportGraphSync } from "./repair-transport-graph";
import { loadActivitiesForTrip } from "./activities-persistence";
import type { TripEntityGraph } from "./types";

export async function loadTripGraph(
  tripId: string,
  options?: { skipFlightLookup?: boolean },
): Promise<TripEntityGraph | null> {
  const state = await loadTripSetupState(tripId, options);
  if (!state) return null;

  const [activities, bookingRows, tripRow, contactCount, phraseCount] = await Promise.all([
    loadActivitiesForTrip(tripId),
    db.select().from(entityBookingDetails).where(eq(entityBookingDetails.tripId, tripId)),
    db
      .select({
        localEmergencyNumber: trips.localEmergencyNumber,
        schoolEmergencyPhone: trips.schoolEmergencyPhone,
        publishedVersion: trips.publishedVersion,
        viewerGalleryEnabled: trips.viewerGalleryEnabled,
        viewerRoomDetailsEnabled: trips.viewerRoomDetailsEnabled,
      })
      .from(trips)
      .where(eq(trips.id, tripId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.tripId, tripId))
      .then((rows) => rows.length),
    db
      .select({ id: emergencyPhrases.id })
      .from(emergencyPhrases)
      .where(eq(emergencyPhrases.tripId, tripId))
      .then((rows) => rows.length),
  ]);

  const base = repairTransportGraphSync(setupStateToGraph(tripId, { ...state, activities }));
  const hiddenPendingTransportNeedKeys = await loadHiddenPendingTransportNeedKeys(tripId);

  return {
    ...base,
    hiddenPendingTransportNeedKeys,
    bookingsSummary: bookingRows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      bookingStatus: row.bookingStatus,
      supplier: row.supplier,
      bookingReference: row.bookingReference,
    })),
    emergencySummary: {
      localEmergencyNumber: tripRow?.localEmergencyNumber ?? null,
      schoolEmergencyPhone: tripRow?.schoolEmergencyPhone ?? null,
      contactsCount: contactCount,
      phrasesCount: phraseCount,
    },
    publishSummary: {
      publishedVersion: tripRow?.publishedVersion ?? 0,
      viewerGalleryEnabled: tripRow?.viewerGalleryEnabled ?? false,
      viewerRoomDetailsEnabled: tripRow?.viewerRoomDetailsEnabled ?? false,
    },
  };
}

/** @deprecated use loadTripGraph */
export const loadTripEntityGraph = loadTripGraph;
