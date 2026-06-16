import type { ParticipantFilteredTripV1 } from "@/lib/publish/filter-for-participant";
import type {
  PublishedAccommodationAssignment,
  PublishedTripSnapshotV1,
  ResolvedAccommodation,
} from "@/types/published-trip";
import {
  filterEntitiesForParticipant,
  isVisibleToParticipant,
} from "@/lib/visibility/resolve-visible";
import type { ParticipantVisibilityContext } from "@/lib/visibility/types";
import { targetsForEntity } from "@/lib/visibility/types";

function isParticipantFilteredTrip(
  snapshot: PublishedTripSnapshotV1 | ParticipantFilteredTripV1,
): snapshot is ParticipantFilteredTripV1 {
  return "participant" in snapshot;
}

function buildParticipantContext(
  snapshot: PublishedTripSnapshotV1 | ParticipantFilteredTripV1,
  participantId: string,
  dateISO?: string,
): ParticipantVisibilityContext {
  if (isParticipantFilteredTrip(snapshot)) {
    if (snapshot.participant.id !== participantId) {
      throw new Error("Participant not found in filtered trip");
    }
    return {
      participantId,
      role: snapshot.participant.role,
      groupIds: new Set(snapshot.groups.map((g) => g.id)),
      roomId: snapshot.room?.id ?? null,
      dateISO,
    };
  }

  const participant = snapshot.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error("Participant not found in snapshot");

  const groupIds = new Set(
    snapshot.participantGroups
      .filter((pg) => {
        if (pg.participantId !== participantId) return false;
        if (dateISO && pg.effectiveFrom && dateISO < pg.effectiveFrom) return false;
        if (dateISO && pg.effectiveTo && dateISO > pg.effectiveTo) return false;
        return true;
      })
      .map((pg) => pg.groupId),
  );

  const roomId =
    snapshot.participantRooms.find((pr) => pr.participantId === participantId)?.roomId ??
    null;

  return {
    participantId,
    role: participant.role,
    groupIds,
    roomId,
    dateISO,
  };
}

function withLegacyAudience<T extends { visibilityMode?: string; audienceType?: string; audienceId?: string | null }>(
  entity: T,
): T & { visibilityMode: "everyone" | "staff_only" | "viewers_only" | "hidden_from_students" | "custom"; audienceType: "everyone" | "group" | "room" | "participant"; audienceId: string | null } {
  return {
    ...entity,
    visibilityMode: (entity.visibilityMode ?? "everyone") as "everyone",
    audienceType: (entity.audienceType ?? "everyone") as "everyone",
    audienceId: entity.audienceId ?? null,
  };
}

export function resolveAccommodationForDate(
  snapshot: PublishedTripSnapshotV1 | ParticipantFilteredTripV1,
  participantId: string,
  dateISO: string,
): ResolvedAccommodation | null {
  const ctx = buildParticipantContext(snapshot, participantId, dateISO);
  const assignments = snapshot.accommodationAssignments ?? [];
  const stays = snapshot.accommodationStays ?? [];
  const allTargets = snapshot.visibilityTargets ?? [];

  const inRange = (start: string, end: string) => dateISO >= start && dateISO <= end;

  const participantAssignment = assignments.find(
    (a) => a.participantId === participantId && inRange(a.startDate, a.endDate),
  );
  if (participantAssignment) {
    return assignmentToResolved(participantAssignment, "assignment");
  }

  const groupAssignment = assignments.find(
    (a) => a.groupId && ctx.groupIds.has(a.groupId) && inRange(a.startDate, a.endDate),
  );
  if (groupAssignment) {
    return assignmentToResolved(groupAssignment, "assignment");
  }

  const roomAssignment = assignments.find(
    (a) => a.roomId && ctx.roomId && a.roomId === ctx.roomId && inRange(a.startDate, a.endDate),
  );
  if (roomAssignment) {
    return assignmentToResolved(roomAssignment, "assignment");
  }

  for (const stay of stays) {
    if (!inRange(stay.checkInDate, stay.checkOutDate)) continue;
    const entity = withLegacyAudience(stay);
    if (
      isVisibleToParticipant(
        entity,
        ctx,
        targetsForEntity("accommodation_stay", stay.id, allTargets),
      ) &&
      entity.visibilityMode === "everyone"
    ) {
      return {
        source: "everyone_stay",
        name: stay.name,
        address: stay.address,
        phone: stay.phone ?? null,
        stayType: stay.stayType,
        cityLabel: stay.cityLabel,
      };
    }
  }

  if (ctx.roomId) {
    const room = snapshot.rooms?.find((r) => r.id === ctx.roomId);
    if (room) {
      const entity = withLegacyAudience(room);
      if (
        isVisibleToParticipant(
          entity,
          ctx,
          targetsForEntity("room", room.id, allTargets),
        )
      ) {
        return {
          source: "room",
          name: room.hotelName ?? room.roomName,
          address: room.hotelAddress,
          phone: room.hotelPhone ?? null,
          stayType: "homestay",
          cityLabel: null,
          hotelPhone: room.hotelPhone ?? null,
          nearestStation: room.nearestStation,
          nearestStationNotes: room.nearestStationNotes ?? null,
          nearestBusStopName: room.nearestBusStopName ?? null,
          routeNotesToAccommodation: room.routeNotesToAccommodation ?? null,
          staticMapUrl: room.staticMapUrl ?? null,
          mapsUrl: room.mapsUrl ?? null,
        };
      }
    }
  }

  return null;
}

function assignmentToResolved(
  a: PublishedAccommodationAssignment,
  source: ResolvedAccommodation["source"],
): ResolvedAccommodation {
  return {
    source,
    name: a.stayName,
    address: a.stayAddress,
    phone: a.stayPhone,
    stayType: a.stayType,
    cityLabel: a.cityLabel,
  };
}

export { buildParticipantContext };
