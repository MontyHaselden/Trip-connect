import {
  filterSnapshotForParticipantV1,
  type ParticipantFilteredTripV1,
} from "@/lib/publish/filter-for-participant";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

function isFilteredPayload(x: unknown): x is ParticipantFilteredTripV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; participant?: unknown; days?: unknown };
  return Boolean(o.trip && o.participant && o.days);
}

function isFullSnapshot(x: unknown): x is PublishedTripSnapshotV1 {
  if (!x || typeof x !== "object") return false;
  const o = x as { trip?: unknown; participants?: unknown; days?: unknown };
  return Boolean(o.trip && o.days && Array.isArray(o.participants));
}

export function resolveStudentTripPayload(
  payload: unknown,
  participantId: string | null,
): ParticipantFilteredTripV1 | null {
  if (isFilteredPayload(payload)) return payload;

  if (!isFullSnapshot(payload) || !participantId) return null;

  try {
    return filterSnapshotForParticipantV1(payload, participantId);
  } catch {
    return null;
  }
}

export function hasTodaySchedule(
  trip: ParticipantFilteredTripV1 | null,
): trip is ParticipantFilteredTripV1 {
  return Boolean(trip?.trip && trip.days?.length && trip.itineraryItems);
}

export function hasMyTripProfile(
  trip: ParticipantFilteredTripV1 | null,
): trip is ParticipantFilteredTripV1 {
  return Boolean(trip?.trip && trip.participant);
}
