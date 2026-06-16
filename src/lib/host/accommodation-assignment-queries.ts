import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  accommodationAssignments,
  groups,
  participants,
  rooms,
  tripAccommodationStays,
} from "@/lib/db/schema";

export type AccommodationAssignmentRow = {
  id: string;
  stayId: string;
  stayName: string | null;
  stayCityLabel: string;
  participantId: string | null;
  participantName: string | null;
  groupId: string | null;
  groupName: string | null;
  roomId: string | null;
  roomName: string | null;
  startDate: string;
  endDate: string;
};

export async function loadAccommodationAssignments(
  tripId: string,
): Promise<AccommodationAssignmentRow[]> {
  const rows = await db
    .select({
      id: accommodationAssignments.id,
      stayId: accommodationAssignments.stayId,
      stayName: tripAccommodationStays.name,
      stayCityLabel: tripAccommodationStays.cityLabel,
      participantId: accommodationAssignments.participantId,
      participantName: participants.fullName,
      groupId: accommodationAssignments.groupId,
      groupName: groups.name,
      roomId: accommodationAssignments.roomId,
      roomName: rooms.roomName,
      startDate: accommodationAssignments.startDate,
      endDate: accommodationAssignments.endDate,
    })
    .from(accommodationAssignments)
    .innerJoin(
      tripAccommodationStays,
      eq(accommodationAssignments.stayId, tripAccommodationStays.id),
    )
    .leftJoin(participants, eq(accommodationAssignments.participantId, participants.id))
    .leftJoin(groups, eq(accommodationAssignments.groupId, groups.id))
    .leftJoin(rooms, eq(accommodationAssignments.roomId, rooms.id))
    .where(eq(tripAccommodationStays.tripId, tripId))
    .orderBy(asc(accommodationAssignments.startDate));

  return rows;
}

export async function validateAssignmentTargets(
  tripId: string,
  input: {
    participantId?: string | null;
    groupId?: string | null;
    roomId?: string | null;
  },
): Promise<void> {
  const targetCount = [input.participantId, input.groupId, input.roomId].filter(Boolean).length;
  if (targetCount !== 1) {
    throw new Error("Assign to exactly one participant, group, or room.");
  }

  if (input.participantId) {
    const row = await db
      .select({ id: participants.id })
      .from(participants)
      .where(and(eq(participants.id, input.participantId), eq(participants.tripId, tripId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!row) throw new Error("Invalid participant.");
  }

  if (input.groupId) {
    const row = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(eq(groups.id, input.groupId), eq(groups.tripId, tripId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!row) throw new Error("Invalid group.");
  }

  if (input.roomId) {
    const row = await db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(eq(rooms.id, input.roomId), eq(rooms.tripId, tripId)))
      .limit(1)
      .then((rows) => rows[0]);
    if (!row) throw new Error("Invalid room.");
  }
}

export async function validateStayForTrip(tripId: string, stayId: string) {
  const stay = await db
    .select({ id: tripAccommodationStays.id })
    .from(tripAccommodationStays)
    .where(and(eq(tripAccommodationStays.id, stayId), eq(tripAccommodationStays.tripId, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!stay) throw new Error("Stay not found.");
  return stay;
}
