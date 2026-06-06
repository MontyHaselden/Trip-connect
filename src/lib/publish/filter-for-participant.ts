import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export type ParticipantFilteredTripV1 = Omit<
  PublishedTripSnapshotV1,
  "participants" | "participantGroups" | "participantRooms"
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
    roommates: Array<{ id: string; fullName: string }>;
  };
  groups: Array<{ id: string; name: string; type: string; description: string | null; sortOrder: number }>;
};

export function filterSnapshotForParticipantV1(
  snapshot: PublishedTripSnapshotV1,
  participantId: string,
): ParticipantFilteredTripV1 {
  const participant = snapshot.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error("Participant not found in snapshot");

  const groupIds = new Set(
    snapshot.participantGroups
      .filter((pg) => pg.participantId === participantId)
      .map((pg) => pg.groupId),
  );

  const roomId =
    snapshot.participantRooms.find((pr) => pr.participantId === participantId)
      ?.roomId ?? null;

  const visibleItem = (item: PublishedTripSnapshotV1["itineraryItems"][number]) => {
    if (item.audienceType === "everyone") return true;
    if (!item.audienceId) return false;
    if (item.audienceType === "participant") return item.audienceId === participantId;
    if (item.audienceType === "group") return groupIds.has(item.audienceId);
    if (item.audienceType === "room") return roomId !== null && item.audienceId === roomId;
    return false;
  };

  const itineraryItems = snapshot.itineraryItems.filter(visibleItem);

  const contacts = snapshot.contacts.filter((c) => c.visibility === "students");

  const myGroups = snapshot.groups.filter((g) => groupIds.has(g.id));

  const room = roomId
    ? (() => {
        const r = snapshot.rooms.find((x) => x.id === roomId);
        if (!r) return null;
        const roommateIds = snapshot.participantRooms
          .filter((pr) => pr.roomId === roomId)
          .map((pr) => pr.participantId);
        const roommates = snapshot.participants
          .filter((p) => roommateIds.includes(p.id) && p.id !== participantId)
          .map((p) => ({ id: p.id, fullName: p.fullName }));
        return {
          id: r.id,
          roomName: r.roomName,
          hotelName: r.hotelName,
          hotelAddress: r.hotelAddress,
          nearestStation: r.nearestStation,
          roommates,
        };
      })()
    : null;

  return {
    version: snapshot.version,
    publishedAt: snapshot.publishedAt,
    trip: snapshot.trip,
    days: snapshot.days,
    itineraryItems,
    accommodationStays: snapshot.accommodationStays,
    dayReminders: snapshot.dayReminders,
    tomorrowPrepItems: snapshot.tomorrowPrepItems,
    contacts,
    groups: myGroups,
    rooms: snapshot.rooms, // safe: no student phones inside rooms
    phraseCategories: snapshot.phraseCategories,
    phrases: snapshot.phrases,
    participant,
    room,
  };
}

