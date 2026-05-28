import { asc, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db/client";
import {
  contacts,
  emergencyPhraseCategories,
  emergencyPhrases,
  groups,
  itineraryItems,
  participantGroups,
  participantRooms,
  participants,
  rooms,
  tomorrowPrepItems,
  tripDays,
  trips,
} from "@/lib/db/schema";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

type DbLike = typeof defaultDb;

export async function buildSnapshotV1(
  tripId: string,
  version: number,
  db: DbLike = defaultDb,
): Promise<PublishedTripSnapshotV1> {
  const trip = await db
    .select({
      id: trips.id,
      name: trips.name,
      schoolName: trips.schoolName,
      startDate: trips.startDate,
      endDate: trips.endDate,
      destinationCountry: trips.destinationCountry,
      destinationLanguage: trips.destinationLanguage,
      timezone: trips.timezone,
      publishedVersion: trips.publishedVersion,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!trip) throw new Error("Trip not found");

  const [
    dayRows,
    itemRows,
    prepRows,
    contactRows,
    participantRows,
    groupRows,
    participantGroupRows,
    roomRows,
    participantRoomRows,
    categoryRows,
    phraseRows,
  ] = await Promise.all([
    db
      .select({
        id: tripDays.id,
        date: tripDays.date,
        cityLabel: tripDays.cityLabel,
        summary: tripDays.summary,
        sortOrder: tripDays.sortOrder,
      })
      .from(tripDays)
      .where(eq(tripDays.tripId, tripId))
      .orderBy(asc(tripDays.sortOrder)),
    db
      .select({
        id: itineraryItems.id,
        tripDayId: itineraryItems.tripDayId,
        startTime: itineraryItems.startTime,
        endTime: itineraryItems.endTime,
        title: itineraryItems.title,
        locationName: itineraryItems.locationName,
        address: itineraryItems.address,
        mapQuery: itineraryItems.mapQuery,
        leaveByTime: itineraryItems.leaveByTime,
        transportNote: itineraryItems.transportNote,
        bringNote: itineraryItems.bringNote,
        hostNote: itineraryItems.hostNote,
        audienceType: itineraryItems.audienceType,
        audienceId: itineraryItems.audienceId,
        sortOrder: itineraryItems.sortOrder,
      })
      .from(itineraryItems)
      .where(eq(itineraryItems.tripId, tripId))
      .orderBy(asc(itineraryItems.tripDayId), asc(itineraryItems.sortOrder)),
    db
      .select({
        id: tomorrowPrepItems.id,
        tripDayId: tomorrowPrepItems.tripDayId,
        text: tomorrowPrepItems.text,
        sortOrder: tomorrowPrepItems.sortOrder,
      })
      .from(tomorrowPrepItems)
      .where(eq(tomorrowPrepItems.tripId, tripId))
      .orderBy(asc(tomorrowPrepItems.tripDayId), asc(tomorrowPrepItems.sortOrder)),
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        role: contacts.role,
        phoneNumber: contacts.phoneNumber,
        visibility: contacts.visibility,
        sortOrder: contacts.sortOrder,
        isEmergencyLead: contacts.isEmergencyLead,
      })
      .from(contacts)
      .where(eq(contacts.tripId, tripId))
      .orderBy(asc(contacts.sortOrder)),
    db
      .select({
        id: participants.id,
        fullName: participants.fullName,
        phoneNumberE164: participants.phoneNumberE164,
        role: participants.role,
      })
      .from(participants)
      .where(eq(participants.tripId, tripId))
      .orderBy(asc(participants.fullName)),
    db
      .select({
        id: groups.id,
        name: groups.name,
        type: groups.type,
        description: groups.description,
        sortOrder: groups.sortOrder,
      })
      .from(groups)
      .where(eq(groups.tripId, tripId))
      .orderBy(asc(groups.sortOrder)),
    db
      .select({
        participantId: participantGroups.participantId,
        groupId: participantGroups.groupId,
      })
      .from(participantGroups),
    db
      .select({
        id: rooms.id,
        roomName: rooms.roomName,
        hotelName: rooms.hotelName,
        hotelAddress: rooms.hotelAddress,
        nearestStation: rooms.nearestStation,
        notes: rooms.notes,
        sortOrder: rooms.sortOrder,
      })
      .from(rooms)
      .where(eq(rooms.tripId, tripId))
      .orderBy(asc(rooms.sortOrder)),
    db
      .select({
        participantId: participantRooms.participantId,
        roomId: participantRooms.roomId,
      })
      .from(participantRooms),
    db
      .select({
        id: emergencyPhraseCategories.id,
        name: emergencyPhraseCategories.name,
        sortOrder: emergencyPhraseCategories.sortOrder,
      })
      .from(emergencyPhraseCategories)
      .where(eq(emergencyPhraseCategories.tripId, tripId))
      .orderBy(asc(emergencyPhraseCategories.sortOrder)),
    db
      .select({
        id: emergencyPhrases.id,
        categoryId: emergencyPhrases.categoryId,
        englishText: emergencyPhrases.englishText,
        translatedText: emergencyPhrases.translatedText,
        pronunciation: emergencyPhrases.pronunciation,
        notes: emergencyPhrases.notes,
        source: emergencyPhrases.source,
        sortOrder: emergencyPhrases.sortOrder,
      })
      .from(emergencyPhrases)
      .where(eq(emergencyPhrases.tripId, tripId))
      .orderBy(asc(emergencyPhrases.categoryId), asc(emergencyPhrases.sortOrder)),
  ]);

  // Narrow assignment rows to trip participants only (cheap safety).
  const participantIdSet = new Set(participantRows.map((p) => p.id));
  const tripParticipantGroups = participantGroupRows.filter((r) =>
    participantIdSet.has(r.participantId),
  );
  const tripParticipantRooms = participantRoomRows.filter((r) =>
    participantIdSet.has(r.participantId),
  );

  return {
    version,
    publishedAt: new Date().toISOString(),
    trip: {
      id: trip.id,
      name: trip.name,
      schoolName: trip.schoolName,
      startDate: trip.startDate,
      endDate: trip.endDate,
      destinationCountry: trip.destinationCountry,
      destinationLanguage: trip.destinationLanguage,
      timezone: trip.timezone,
      publishedVersion: trip.publishedVersion,
    },
    days: dayRows,
    itineraryItems: itemRows,
    tomorrowPrepItems: prepRows,
    contacts: contactRows,
    participants: participantRows,
    groups: groupRows,
    participantGroups: tripParticipantGroups,
    rooms: roomRows,
    participantRooms: tripParticipantRooms,
    phraseCategories: categoryRows,
    phrases: phraseRows,
  };
}

