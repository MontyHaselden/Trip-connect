import { asc, eq, max } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groups,
  participantGroups,
  participantRooms,
  participants,
  rooms,
} from "@/lib/db/schema";

export async function loadRoster(tripId: string) {
  const [participantRows, roomRows, groupRows, prRows, pgRows] =
    await Promise.all([
      db
        .select()
        .from(participants)
        .where(eq(participants.tripId, tripId))
        .orderBy(asc(participants.fullName)),
      db
        .select()
        .from(rooms)
        .where(eq(rooms.tripId, tripId))
        .orderBy(asc(rooms.sortOrder)),
      db
        .select()
        .from(groups)
        .where(eq(groups.tripId, tripId))
        .orderBy(asc(groups.sortOrder)),
      db.select().from(participantRooms),
      db.select().from(participantGroups),
    ]);

  const participantIds = new Set(participantRows.map((p) => p.id));
  const roomByParticipant = new Map<string, string>();
  for (const pr of prRows) {
    if (participantIds.has(pr.participantId)) {
      roomByParticipant.set(pr.participantId, pr.roomId);
    }
  }

  const groupsByParticipant = new Map<string, string[]>();
  for (const pg of pgRows) {
    if (!participantIds.has(pg.participantId)) continue;
    const arr = groupsByParticipant.get(pg.participantId) ?? [];
    arr.push(pg.groupId);
    groupsByParticipant.set(pg.participantId, arr);
  }

  return {
    participants: participantRows.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      phoneNumberE164: p.phoneNumberE164,
      role: p.role,
      hasPassword: Boolean(p.passwordHash),
      inCostSplit: p.inCostSplit ?? true,
      roomId: roomByParticipant.get(p.id) ?? null,
      groupIds: groupsByParticipant.get(p.id) ?? [],
    })),
    rooms: roomRows.map((r) => ({
      id: r.id,
      roomName: r.roomName,
      hotelName: r.hotelName,
      hotelAddress: r.hotelAddress,
      nearestStation: r.nearestStation,
      notes: r.notes,
      sortOrder: r.sortOrder,
    })),
    groups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      description: g.description,
      sortOrder: g.sortOrder,
    })),
  };
}

export async function nextRoomSortOrder(tripId: string) {
  const row = await db
    .select({ v: max(rooms.sortOrder) })
    .from(rooms)
    .where(eq(rooms.tripId, tripId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function nextGroupSortOrder(tripId: string) {
  const row = await db
    .select({ v: max(groups.sortOrder) })
    .from(groups)
    .where(eq(groups.tripId, tripId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function setParticipantRoom(
  participantId: string,
  roomId: string | null,
) {
  await db
    .delete(participantRooms)
    .where(eq(participantRooms.participantId, participantId));
  if (roomId) {
    await db.insert(participantRooms).values({ participantId, roomId });
  }
}

export async function setParticipantGroups(
  participantId: string,
  groupIds: string[],
) {
  await db
    .delete(participantGroups)
    .where(eq(participantGroups.participantId, participantId));
  if (groupIds.length) {
    await db.insert(participantGroups).values(
      groupIds.map((groupId) => ({ participantId, groupId })),
    );
  }
}

export async function getParticipantForTrip(tripId: string, participantId: string) {
  return db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId))
    .limit(1)
    .then((rows) => {
      const p = rows[0];
      if (!p || p.tripId !== tripId) return null;
      return p;
    });
}

export async function getRoomForTrip(tripId: string, roomId: string) {
  return db
    .select()
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1)
    .then((rows) => {
      const r = rows[0];
      if (!r || r.tripId !== tripId) return null;
      return r;
    });
}

export async function getGroupForTrip(tripId: string, groupId: string) {
  return db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)
    .then((rows) => {
      const g = rows[0];
      if (!g || g.tripId !== tripId) return null;
      return g;
    });
}
