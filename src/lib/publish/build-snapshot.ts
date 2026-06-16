import { asc, eq } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db/client";
import {
  accommodationAssignments,
  contacts,
  dayWeatherSnapshots,
  emergencyPhraseCategories,
  emergencyPhrases,
  groupDayPlaces,
  groupOverlayOps,
  groups,
  itineraryItems,
  participantGroups,
  participantRooms,
  participants,
  rooms,
  tomorrowPrepItems,
  tripAccommodationStays,
  tripDayReminders,
  tripDays,
  tripPhotos,
  tripTransportLegs,
  trips,
  visibilityTargets,
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
      localEmergencyNumber: trips.localEmergencyNumber,
      schoolEmergencyPhone: trips.schoolEmergencyPhone,
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
    stayRows,
    reminderRows,
    assignmentRows,
    transportRows,
    visibilityTargetRows,
    groupDayPlaceRows,
    groupOverlayOpRows,
  ] = await Promise.all([
    db
      .select({
        id: tripDays.id,
        date: tripDays.date,
        cityLabel: tripDays.cityLabel,
        calendarLabel: tripDays.calendarLabel,
        summary: tripDays.summary,
        sortOrder: tripDays.sortOrder,
        dayType: tripDays.dayType,
        secondaryCityLabel: tripDays.secondaryCityLabel,
        isBufferDay: tripDays.isBufferDay,
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
        visibilityMode: itineraryItems.visibilityMode,
        category: itineraryItems.category,
        sortOrder: itineraryItems.sortOrder,
        bookingStatus: itineraryItems.bookingStatus,
        originGroupId: itineraryItems.originGroupId,
        sourceEntityId: itineraryItems.sourceEntityId,
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
        visibilityMode: tomorrowPrepItems.visibilityMode,
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
        visibilityMode: contacts.visibilityMode,
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
        isMain: groups.isMain,
      })
      .from(groups)
      .where(eq(groups.tripId, tripId))
      .orderBy(asc(groups.sortOrder)),
    db
      .select({
        participantId: participantGroups.participantId,
        groupId: participantGroups.groupId,
        effectiveFrom: participantGroups.effectiveFrom,
        effectiveTo: participantGroups.effectiveTo,
      })
      .from(participantGroups),
    db
      .select({
        id: rooms.id,
        roomName: rooms.roomName,
        hotelName: rooms.hotelName,
        hotelAddress: rooms.hotelAddress,
        nearestStation: rooms.nearestStation,
        hotelPhone: rooms.hotelPhone,
        nearestStationNotes: rooms.nearestStationNotes,
        nearestBusStopName: rooms.nearestBusStopName,
        routeNotesToAccommodation: rooms.routeNotesToAccommodation,
        staticMapUrl: rooms.staticMapUrl,
        mapsUrl: rooms.mapsUrl,
        notes: rooms.notes,
        sortOrder: rooms.sortOrder,
        visibilityMode: rooms.visibilityMode,
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
    db
      .select({
        id: tripAccommodationStays.id,
        cityLabel: tripAccommodationStays.cityLabel,
        stayType: tripAccommodationStays.stayType,
        name: tripAccommodationStays.name,
        address: tripAccommodationStays.address,
        phone: tripAccommodationStays.phone,
        checkInDate: tripAccommodationStays.checkInDate,
        checkOutDate: tripAccommodationStays.checkOutDate,
        visibilityMode: tripAccommodationStays.visibilityMode,
        originGroupId: tripAccommodationStays.originGroupId,
        sourceEntityId: tripAccommodationStays.sourceEntityId,
      })
      .from(tripAccommodationStays)
      .where(eq(tripAccommodationStays.tripId, tripId))
      .orderBy(asc(tripAccommodationStays.sortOrder)),
    db
      .select({
        id: tripDayReminders.id,
        tripDayId: tripDayReminders.tripDayId,
        title: tripDayReminders.title,
        reminderTime: tripDayReminders.reminderTime,
        note: tripDayReminders.note,
        sortOrder: tripDayReminders.sortOrder,
        audienceType: tripDayReminders.audienceType,
        audienceId: tripDayReminders.audienceId,
        visibilityMode: tripDayReminders.visibilityMode,
      })
      .from(tripDayReminders)
      .where(eq(tripDayReminders.tripId, tripId))
      .orderBy(asc(tripDayReminders.tripDayId), asc(tripDayReminders.sortOrder)),
    db
      .select({
        id: accommodationAssignments.id,
        stayId: accommodationAssignments.stayId,
        participantId: accommodationAssignments.participantId,
        groupId: accommodationAssignments.groupId,
        roomId: accommodationAssignments.roomId,
        startDate: accommodationAssignments.startDate,
        endDate: accommodationAssignments.endDate,
        stayName: tripAccommodationStays.name,
        stayAddress: tripAccommodationStays.address,
        stayPhone: tripAccommodationStays.phone,
        stayType: tripAccommodationStays.stayType,
        cityLabel: tripAccommodationStays.cityLabel,
      })
      .from(accommodationAssignments)
      .innerJoin(
        tripAccommodationStays,
        eq(accommodationAssignments.stayId, tripAccommodationStays.id),
      )
      .where(eq(tripAccommodationStays.tripId, tripId)),
    db
      .select({
        id: tripTransportLegs.id,
        legKind: tripTransportLegs.legKind,
        transportType: tripTransportLegs.transportType,
        travelDate: tripTransportLegs.travelDate,
        departureTime: tripTransportLegs.departureTime,
        arrivalTime: tripTransportLegs.arrivalTime,
        fromCity: tripTransportLegs.fromCity,
        toCity: tripTransportLegs.toCity,
        fromStation: tripTransportLegs.fromStation,
        toStation: tripTransportLegs.toStation,
        operator: tripTransportLegs.operator,
        referenceNumber: tripTransportLegs.referenceNumber,
        flightNumber: tripTransportLegs.flightNumber,
        notes: tripTransportLegs.notes,
        sortOrder: tripTransportLegs.sortOrder,
        visibilityMode: tripTransportLegs.visibilityMode,
        bookingStatus: tripTransportLegs.bookingStatus,
        originGroupId: tripTransportLegs.originGroupId,
        sourceEntityId: tripTransportLegs.sourceEntityId,
      })
      .from(tripTransportLegs)
      .where(eq(tripTransportLegs.tripId, tripId))
      .orderBy(asc(tripTransportLegs.sortOrder)),
    db
      .select({
        entityType: visibilityTargets.entityType,
        entityId: visibilityTargets.entityId,
        targetType: visibilityTargets.targetType,
        targetId: visibilityTargets.targetId,
      })
      .from(visibilityTargets)
      .where(eq(visibilityTargets.tripId, tripId)),
    db
      .select({
        id: groupDayPlaces.id,
        groupId: groupDayPlaces.groupId,
        date: groupDayPlaces.date,
        primaryCity: groupDayPlaces.primaryCity,
        secondaryCity: groupDayPlaces.secondaryCity,
        primaryShare: groupDayPlaces.primaryShare,
        dayType: groupDayPlaces.dayType,
        calendarLabel: groupDayPlaces.calendarLabel,
        weatherLocationQuery: groupDayPlaces.weatherLocationQuery,
      })
      .from(groupDayPlaces)
      .where(eq(groupDayPlaces.tripId, tripId))
      .orderBy(asc(groupDayPlaces.date)),
    db
      .select({
        id: groupOverlayOps.id,
        groupId: groupOverlayOps.groupId,
        entityType: groupOverlayOps.entityType,
        baseEntityId: groupOverlayOps.baseEntityId,
        op: groupOverlayOps.op,
        replacementEntityId: groupOverlayOps.replacementEntityId,
        effectiveFrom: groupOverlayOps.effectiveFrom,
        effectiveTo: groupOverlayOps.effectiveTo,
      })
      .from(groupOverlayOps)
      .where(eq(groupOverlayOps.tripId, tripId)),
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

  const itemCountByDayId = new Map<string, number>();
  for (const item of itemRows) {
    itemCountByDayId.set(
      item.tripDayId,
      (itemCountByDayId.get(item.tripDayId) ?? 0) + 1,
    );
  }
  const reminderCountByDayId = new Map<string, number>();
  for (const rem of reminderRows) {
    reminderCountByDayId.set(
      rem.tripDayId,
      (reminderCountByDayId.get(rem.tripDayId) ?? 0) + 1,
    );
  }

  const daysWithWeather = dayRows
    .filter(
      (d: { id: string; isBufferDay: boolean }) => {
        if (!d.isBufferDay) return true;
        return (
          (itemCountByDayId.get(d.id) ?? 0) > 0 ||
          (reminderCountByDayId.get(d.id) ?? 0) > 0
        );
      },
    )
    .map(
      (d: {
        id: string;
        date: string;
        cityLabel: string;
        calendarLabel: string | null;
        summary: string | null;
        sortOrder: number;
        dayType: string | null;
        secondaryCityLabel: string | null;
        isBufferDay: boolean;
      }) => ({
        id: d.id,
        date: d.date,
        cityLabel: d.cityLabel,
        calendarLabel: d.calendarLabel,
        summary: d.summary,
        sortOrder: d.sortOrder,
        dayType: d.dayType,
        secondaryCityLabel: d.secondaryCityLabel,
        isBufferDay: d.isBufferDay,
        weather: weatherByDayId.get(d.id) ?? null,
      }),
    );

  const prepRowsWithAudience = prepRows.map(
    (p: {
      id: string;
      tripDayId: string;
      text: string;
      sortOrder: number;
      visibilityMode?: string;
    }) => ({
      ...p,
      visibilityMode: p.visibilityMode ?? "everyone",
      audienceType: "everyone" as const,
      audienceId: null,
    }),
  );

  const contactRowsWithAudience = contactRows.map(
    (c: {
      id: string;
      name: string;
      role: string;
      phoneNumber: string;
      visibility: "students" | "hosts_only";
      sortOrder: number;
      isEmergencyLead: boolean;
      visibilityMode?: string;
    }) => ({
      ...c,
      visibilityMode: c.visibilityMode ?? "everyone",
      audienceType: "everyone" as const,
      audienceId: null,
    }),
  );

  const stayRowsWithAudience = stayRows.map(
    (s: {
      id: string;
      cityLabel: string;
      stayType: string;
      name: string | null;
      address: string | null;
      phone?: string | null;
      checkInDate: string;
      checkOutDate: string;
      visibilityMode?: string;
    }) => ({
      ...s,
      visibilityMode: s.visibilityMode ?? "everyone",
      audienceType: "everyone" as const,
      audienceId: null,
    }),
  );

  const roomRowsWithAudience = roomRows.map(
    (r: { id: string; visibilityMode?: string }) => ({
      ...r,
      visibilityMode: r.visibilityMode ?? "everyone",
      audienceType: "everyone" as const,
      audienceId: null,
    }),
  );

  const transportLegs = transportRows.map((leg: { visibilityMode?: string }) => ({
    ...leg,
    visibilityMode: leg.visibilityMode ?? "everyone",
    audienceType: "everyone" as const,
    audienceId: null,
  }));

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
      localEmergencyNumber: trip.localEmergencyNumber ?? null,
      schoolEmergencyPhone: trip.schoolEmergencyPhone ?? null,
    },
    days: daysWithWeather,
    itineraryItems: itemRows,
    accommodationStays: stayRowsWithAudience,
    accommodationAssignments: assignmentRows,
    transportLegs,
    visibilityTargets: visibilityTargetRows,
    dayReminders: reminderRows,
    tomorrowPrepItems: prepRowsWithAudience,
    contacts: contactRowsWithAudience,
    participants: participantRows,
    groups: groupRows.map(
      (g: { isMain?: boolean }) => ({
        ...g,
        isMain: Boolean(g.isMain),
      }),
    ),
    groupDayPlaces: groupDayPlaceRows.map(
      (p: { primaryShare: string | number }) => ({
        ...p,
        primaryShare: Number(p.primaryShare),
      }),
    ),
    groupOverlayOps: groupOverlayOpRows,
    participantGroups: tripParticipantGroups,
    rooms: roomRowsWithAudience,
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

