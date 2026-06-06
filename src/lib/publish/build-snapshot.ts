import { asc, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db/client";
import {
  contacts,
  dayWeatherSnapshots,
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
  tripPhotos,
  trips,
} from "@/lib/db/schema";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export async function buildSnapshotV1(
  tripId: string,
  version: number,
  // Drizzle's transaction type differs from the base DB type; accept either.
  // We only rely on the shared query builder surface.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any = defaultDb,
): Promise<PublishedTripSnapshotV1> {
  const tripRows = await db
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
      viewerGalleryEnabled: trips.viewerGalleryEnabled,
      viewerRoomDetailsEnabled: trips.viewerRoomDetailsEnabled,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);

  const trip = tripRows[0] ?? null;

  if (!trip) throw new Error("Trip not found");

  const [
    dayRows,
    weatherRows,
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
    photoRows,
  ] = await Promise.all([
    db
      .select({
        id: tripDays.id,
        date: tripDays.date,
        cityLabel: tripDays.cityLabel,
        calendarLabel: tripDays.calendarLabel,
        summary: tripDays.summary,
        sortOrder: tripDays.sortOrder,
      })
      .from(tripDays)
      .where(eq(tripDays.tripId, tripId))
      .orderBy(asc(tripDays.sortOrder)),
    db
      .select({
        tripDayId: dayWeatherSnapshots.tripDayId,
        locationQuery: dayWeatherSnapshots.locationQuery,
        tempC: dayWeatherSnapshots.tempC,
        condition: dayWeatherSnapshots.condition,
        advice: dayWeatherSnapshots.advice,
        status: dayWeatherSnapshots.status,
        fetchedAt: dayWeatherSnapshots.fetchedAt,
      })
      .from(dayWeatherSnapshots)
      .innerJoin(tripDays, eq(dayWeatherSnapshots.tripDayId, tripDays.id))
      .where(eq(tripDays.tripId, tripId)),
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
        category: itineraryItems.category,
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
    db
      .select({
        id: tripPhotos.id,
        tripDayId: tripPhotos.tripDayId,
        participantId: tripPhotos.participantId,
        type: tripPhotos.type,
        imageUrl: tripPhotos.imageUrl,
        thumbnailUrl: tripPhotos.thumbnailUrl,
        caption: tripPhotos.caption,
        status: tripPhotos.status,
      })
      .from(tripPhotos)
      .where(eq(tripPhotos.tripId, tripId))
      .orderBy(asc(tripPhotos.uploadedAt)),
  ]);

  // Narrow assignment rows to trip participants only (cheap safety).
  const participantIdSet = new Set(
    participantRows.map((p: { id: string }) => p.id),
  );
  const tripParticipantGroups = participantGroupRows.filter((r: { participantId: string }) =>
    participantIdSet.has(r.participantId),
  );
  const tripParticipantRooms = participantRoomRows.filter((r: { participantId: string }) =>
    participantIdSet.has(r.participantId),
  );

  const weatherByDayId = new Map(
    weatherRows.map(
      (w: {
        tripDayId: string;
        locationQuery: string;
        tempC: number | null;
        condition: string | null;
        advice: string | null;
        status: "available" | "too_far" | "unavailable";
        fetchedAt: Date;
      }) => [
        w.tripDayId,
        {
          locationQuery: w.locationQuery,
          tempC: w.tempC,
          condition: w.condition,
          advice: w.advice,
          status: w.status,
          fetchedAt: w.fetchedAt.toISOString(),
        },
      ],
    ),
  );

  const daysWithWeather = dayRows.map(
    (d: {
      id: string;
      date: string;
      cityLabel: string;
      calendarLabel: string | null;
      summary: string | null;
      sortOrder: number;
    }) => ({
      ...d,
      weather: weatherByDayId.get(d.id) ?? null,
    }),
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
    days: daysWithWeather,
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
    photos: photoRows.filter(
      (p: { status: string }) => p.status === "visible",
    ),
    viewerSettings: {
      galleryEnabled: trip.viewerGalleryEnabled,
      roomDetailsEnabled: trip.viewerRoomDetailsEnabled,
    },
  };
}

