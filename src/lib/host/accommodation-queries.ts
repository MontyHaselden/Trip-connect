import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { itineraryItems, tripDays } from "@/lib/db/schema";
import { loadRoster } from "@/lib/host/roster-queries";

function normalizeHotelKey(name: string, address: string | null) {
  return `${name.trim().toLowerCase()}|${(address ?? "").trim().toLowerCase()}`;
}

export async function loadAccommodationView(tripId: string) {
  const [roster, hotelItems] = await Promise.all([
    loadRoster(tripId),
    db
      .select({
        id: itineraryItems.id,
        title: itineraryItems.title,
        locationName: itineraryItems.locationName,
        address: itineraryItems.address,
        date: tripDays.date,
        cityLabel: tripDays.cityLabel,
      })
      .from(itineraryItems)
      .innerJoin(tripDays, eq(itineraryItems.tripDayId, tripDays.id))
      .where(
        and(eq(itineraryItems.tripId, tripId), eq(itineraryItems.category, "hotel")),
      )
      .orderBy(asc(tripDays.date), asc(itineraryItems.sortOrder)),
  ]);

  const participantById = new Map(
    roster.participants.map((p) => [p.id, p]),
  );
  const roomParticipants = new Map<string, string[]>();
  for (const p of roster.participants) {
    if (!p.roomId) continue;
    const list = roomParticipants.get(p.roomId) ?? [];
    list.push(p.id);
    roomParticipants.set(p.roomId, list);
  }

  type HotelGroup = {
    key: string;
    name: string;
    address: string | null;
    dates: string[];
    cities: string[];
    rooms: Array<{
      id: string;
      roomName: string;
      hotelName: string | null;
      hotelAddress: string | null;
      nearestStation: string | null;
      notes: string | null;
      participantIds: string[];
      participants: Array<{
        id: string;
        fullName: string;
        role: string;
      }>;
    }>;
  };

  const hotelsByKey = new Map<string, HotelGroup>();

  for (const item of hotelItems) {
    const name = item.locationName?.trim() || item.title.trim();
    const address = item.address ?? null;
    const key = normalizeHotelKey(name, address);
    let group = hotelsByKey.get(key);
    if (!group) {
      group = {
        key,
        name,
        address,
        dates: [],
        cities: [],
        rooms: [],
      };
      hotelsByKey.set(key, group);
    }
    if (!group.dates.includes(item.date)) group.dates.push(item.date);
    if (!group.cities.includes(item.cityLabel)) group.cities.push(item.cityLabel);
  }

  const assignedRoomIds = new Set<string>();

  for (const room of roster.rooms) {
    const hotelName = room.hotelName?.trim() || "Accommodation";
    const hotelAddress = room.hotelAddress ?? null;
    const key = normalizeHotelKey(hotelName, hotelAddress);
    const exactKey = [...hotelsByKey.keys()].find(
      (candidate) => candidate === key || candidate.startsWith(`${normalizeHotelKey(hotelName, null)}|`),
    );

    let group = exactKey ? hotelsByKey.get(exactKey) : hotelsByKey.get(key);
    if (!group) {
      group = {
        key,
        name: hotelName,
        address: hotelAddress,
        dates: [],
        cities: [],
        rooms: [],
      };
      hotelsByKey.set(key, group);
    }

    const pids = roomParticipants.get(room.id) ?? [];
    group.rooms.push({
      id: room.id,
      roomName: room.roomName,
      hotelName: room.hotelName,
      hotelAddress: room.hotelAddress,
      nearestStation: room.nearestStation,
      notes: room.notes,
      participantIds: pids,
      participants: pids
        .map((id) => participantById.get(id))
        .filter(Boolean)
        .map((p) => ({
          id: p!.id,
          fullName: p!.fullName,
          role: p!.role,
        })),
    });
    assignedRoomIds.add(room.id);
  }

  const unassignedParticipants = roster.participants.filter((p) => !p.roomId);

  return {
    hotels: [...hotelsByKey.values()].sort((a, b) =>
      (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""),
    ),
    unassignedParticipants: unassignedParticipants.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      role: p.role,
    })),
    allRooms: roster.rooms,
    allParticipants: roster.participants,
  };
}
