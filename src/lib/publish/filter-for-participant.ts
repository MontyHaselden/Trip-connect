import type {
  PublishedTripSnapshotV1,
} from "@/types/published-trip";
import { resolveLayersForParticipant } from "@/lib/groups/resolve-layers";
import {
  filterEntitiesForParticipant,
  isVisibleToParticipant,
} from "@/lib/visibility/resolve-visible";
import { buildParticipantContext } from "@/lib/student/resolve-accommodation-for-date";
import { targetsForEntity } from "@/lib/visibility/types";

export type ParticipantFilteredTripV1 = Omit<
  PublishedTripSnapshotV1,
  "participants" | "participantGroups" | "participantRooms" | "photos" | "viewerSettings"
> & {
  participant: {
    id: string;
    fullName: string;
    phoneNumberE164: string;
    role: "student" | "helper" | "teacher" | "host";
  };
  room: null | {
    id: string;
    roomName: string;
    hotelName: string | null;
    hotelAddress: string | null;
    nearestStation: string | null;
    hotelPhone: string | null;
    nearestStationNotes: string | null;
    nearestBusStopName: string | null;
    routeNotesToAccommodation: string | null;
    staticMapUrl: string | null;
    mapsUrl: string | null;
    roommates: Array<{ id: string; fullName: string }>;
  };
  groups: Array<{
    id: string;
    name: string;
    type: string;
    description: string | null;
    sortOrder: number;
    isMain?: boolean;
  }>;
};

function withLegacyAudience<
  T extends {
    visibilityMode?: string;
    audienceType?: string;
    audienceId?: string | null;
  },
>(entity: T) {
  return {
    ...entity,
    visibilityMode: (entity.visibilityMode ?? "everyone") as
      | "everyone"
      | "staff_only"
      | "viewers_only"
      | "hidden_from_students"
      | "custom",
    audienceType: (entity.audienceType ?? "everyone") as
      | "everyone"
      | "group"
      | "room"
      | "participant",
    audienceId: entity.audienceId ?? null,
  };
}

export function filterSnapshotForParticipantV1(
  snapshot: PublishedTripSnapshotV1,
  participantId: string,
): ParticipantFilteredTripV1 {
  const participant = snapshot.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error("Participant not found in snapshot");

  const layered = resolveLayersForParticipant(snapshot, participantId);
  const ctx = buildParticipantContext(layered, participantId);
  const allTargets = layered.visibilityTargets ?? [];

  const itineraryItems = filterEntitiesForParticipant(
    layered.itineraryItems.map(withLegacyAudience),
    "itinerary_item",
    allTargets,
    ctx,
  );

  const dayReminders = filterEntitiesForParticipant(
    (layered.dayReminders ?? []).map(withLegacyAudience),
    "day_reminder",
    allTargets,
    ctx,
  );

  const tomorrowPrepItems = filterEntitiesForParticipant(
    layered.tomorrowPrepItems.map(withLegacyAudience),
    "prep_item",
    allTargets,
    ctx,
  );

  const transportLegs = filterEntitiesForParticipant(
    (layered.transportLegs ?? []).map((leg) =>
      withLegacyAudience({
        ...leg,
        audienceType: leg.audienceType,
        audienceId: leg.audienceId,
      }),
    ),
    "transport_leg",
    allTargets,
    ctx,
  );

  const contacts = filterEntitiesForParticipant(
    layered.contacts
      .filter((c) => c.visibility === "students")
      .map(withLegacyAudience),
    "contact",
    allTargets,
    ctx,
  );

  const visibleRooms = filterEntitiesForParticipant(
    layered.rooms.map(withLegacyAudience),
    "room",
    allTargets,
    ctx,
  );
  const visibleRoomIds = new Set(visibleRooms.map((r) => r.id));

  const accommodationStays = (layered.accommodationStays ?? []).filter((stay) => {
    const entity = withLegacyAudience(stay);
    return isVisibleToParticipant(
      entity,
      ctx,
      targetsForEntity("accommodation_stay", stay.id, allTargets),
    );
  });

  const accommodationAssignments = (layered.accommodationAssignments ?? []).filter(
    (a) => {
      if (a.participantId === participantId) return true;
      if (a.groupId && ctx.groupIds.has(a.groupId)) return true;
      if (a.roomId && ctx.roomId && a.roomId === ctx.roomId) return true;
      return false;
    },
  );

  const myGroups = layered.groups.filter((g) => ctx.groupIds.has(g.id));

  const roomId = ctx.roomId;
  const room = roomId
    ? (() => {
        const r = visibleRooms.find((x) => x.id === roomId);
        if (!r) return null;
        const roommateIds = layered.participantRooms
          .filter((pr) => pr.roomId === roomId)
          .map((pr) => pr.participantId);
        const roommates = layered.participants
          .filter((p) => roommateIds.includes(p.id) && p.id !== participantId)
          .map((p) => ({ id: p.id, fullName: p.fullName }));
        return {
          id: r.id,
          roomName: r.roomName,
          hotelName: r.hotelName,
          hotelAddress: r.hotelAddress,
          nearestStation: r.nearestStation,
          hotelPhone: r.hotelPhone ?? null,
          nearestStationNotes: r.nearestStationNotes ?? null,
          nearestBusStopName: r.nearestBusStopName ?? null,
          routeNotesToAccommodation: r.routeNotesToAccommodation ?? null,
          staticMapUrl: r.staticMapUrl ?? null,
          mapsUrl: r.mapsUrl ?? null,
          roommates,
        };
      })()
    : null;

  return {
    version: layered.version,
    publishedAt: layered.publishedAt,
    trip: layered.trip,
    days: layered.days,
    itineraryItems,
    accommodationStays,
    accommodationAssignments,
    transportLegs,
    dayReminders,
    tomorrowPrepItems,
    contacts,
    groups: myGroups,
    rooms: visibleRooms.filter((r) => visibleRoomIds.has(r.id)),
    phraseCategories: layered.phraseCategories,
    phrases: layered.phrases,
    participant,
    room,
    visibilityTargets: allTargets,
  };
}
