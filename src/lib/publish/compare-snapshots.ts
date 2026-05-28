import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

export type EntityChange = {
  id: string;
  label: string;
};

export type SectionDiff = {
  added: EntityChange[];
  removed: EntityChange[];
  changed: EntityChange[];
};

export type SnapshotDiff = {
  trip: SectionDiff;
  days: SectionDiff;
  itineraryItems: SectionDiff;
  tomorrowPrepItems: SectionDiff;
  contacts: SectionDiff;
  participants: SectionDiff;
  rooms: SectionDiff;
  groups: SectionDiff;
  participantAssignments: SectionDiff;
  phraseCategories: SectionDiff;
  phrases: SectionDiff;
};

function emptySection(): SectionDiff {
  return { added: [], removed: [], changed: [] };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function compareById<T extends { id: string }>(
  prev: T[],
  next: T[],
  label: (row: T) => string,
  fields: (keyof T)[],
): SectionDiff {
  const section = emptySection();
  const prevMap = new Map(prev.map((r) => [r.id, r]));
  const nextMap = new Map(next.map((r) => [r.id, r]));

  for (const row of next) {
    const old = prevMap.get(row.id);
    if (!old) {
      section.added.push({ id: row.id, label: label(row) });
      continue;
    }
    const changed = fields.some((f) => stableJson(old[f]) !== stableJson(row[f]));
    if (changed) section.changed.push({ id: row.id, label: label(row) });
  }

  for (const row of prev) {
    if (!nextMap.has(row.id)) {
      section.removed.push({ id: row.id, label: label(row) });
    }
  }

  return section;
}

function comparePairs(
  prev: Array<{ participantId: string; groupId?: string; roomId?: string }>,
  next: typeof prev,
  label: (row: (typeof prev)[0]) => string,
): SectionDiff {
  const key = (r: (typeof prev)[0]) =>
    "groupId" in r && r.groupId
      ? `${r.participantId}:${r.groupId}`
      : `${r.participantId}:${(r as { roomId: string }).roomId}`;
  const section = emptySection();
  const prevKeys = new Map(prev.map((r) => [key(r), r]));
  const nextKeys = new Map(next.map((r) => [key(r), r]));

  for (const row of next) {
    if (!prevKeys.has(key(row))) {
      section.added.push({ id: key(row), label: label(row) });
    }
  }
  for (const row of prev) {
    if (!nextKeys.has(key(row))) {
      section.removed.push({ id: key(row), label: label(row) });
    }
  }
  return section;
}

export function compareSnapshots(
  previous: PublishedTripSnapshotV1 | null,
  draft: PublishedTripSnapshotV1,
): SnapshotDiff {
  if (!previous) {
    return {
      trip: emptySection(),
      days: {
        added: draft.days.map((d) => ({
          id: d.id,
          label: `${d.date} · ${d.cityLabel}`,
        })),
        removed: [],
        changed: [],
      },
      itineraryItems: {
        added: draft.itineraryItems.map((i) => ({
          id: i.id,
          label: `${i.title}`,
        })),
        removed: [],
        changed: [],
      },
      tomorrowPrepItems: {
        added: draft.tomorrowPrepItems.map((p) => ({
          id: p.id,
          label: p.text.slice(0, 60),
        })),
        removed: [],
        changed: [],
      },
      contacts: {
        added: draft.contacts.map((c) => ({
          id: c.id,
          label: c.name,
        })),
        removed: [],
        changed: [],
      },
      participants: {
        added: draft.participants.map((p) => ({
          id: p.id,
          label: p.fullName,
        })),
        removed: [],
        changed: [],
      },
      rooms: {
        added: draft.rooms.map((r) => ({ id: r.id, label: r.roomName })),
        removed: [],
        changed: [],
      },
      groups: {
        added: draft.groups.map((g) => ({ id: g.id, label: g.name })),
        removed: [],
        changed: [],
      },
      participantAssignments: emptySection(),
      phrases: {
        added: draft.phrases.map((p) => ({
          id: p.id,
          label: p.englishText.slice(0, 60),
        })),
        removed: [],
        changed: [],
      },
      phraseCategories: {
        added: draft.phraseCategories.map((c) => ({
          id: c.id,
          label: c.name,
        })),
        removed: [],
        changed: [],
      },
    };
  }

  const tripFields = [
    "name",
    "schoolName",
    "startDate",
    "endDate",
    "destinationCountry",
    "destinationLanguage",
    "timezone",
  ] as const;
  const tripSection = emptySection();
  const tripChanged = tripFields.some(
    (f) => stableJson(previous.trip[f]) !== stableJson(draft.trip[f]),
  );
  if (tripChanged) {
    tripSection.changed.push({
      id: draft.trip.id,
      label: draft.trip.name,
    });
  }

  const assignmentsPrev = [
    ...previous.participantGroups.map((pg) => ({
      participantId: pg.participantId,
      groupId: pg.groupId,
    })),
    ...previous.participantRooms.map((pr) => ({
      participantId: pr.participantId,
      roomId: pr.roomId,
    })),
  ];
  const assignmentsNext = [
    ...draft.participantGroups.map((pg) => ({
      participantId: pg.participantId,
      groupId: pg.groupId,
    })),
    ...draft.participantRooms.map((pr) => ({
      participantId: pr.participantId,
      roomId: pr.roomId,
    })),
  ];

  return {
    trip: tripSection,
    days: compareById(
      previous.days,
      draft.days,
      (d) => `${d.date} · ${d.cityLabel}`,
      ["date", "cityLabel", "summary", "sortOrder"],
    ),
    itineraryItems: compareById(
      previous.itineraryItems,
      draft.itineraryItems,
      (i) => i.title,
      [
        "tripDayId",
        "startTime",
        "endTime",
        "title",
        "locationName",
        "address",
        "leaveByTime",
        "audienceType",
        "audienceId",
        "sortOrder",
      ],
    ),
    tomorrowPrepItems: compareById(
      previous.tomorrowPrepItems,
      draft.tomorrowPrepItems,
      (p) => p.text.slice(0, 60),
      ["tripDayId", "text", "sortOrder"],
    ),
    contacts: compareById(
      previous.contacts,
      draft.contacts,
      (c) => c.name,
      [
        "name",
        "role",
        "phoneNumber",
        "visibility",
        "isEmergencyLead",
        "sortOrder",
      ],
    ),
    participants: compareById(
      previous.participants,
      draft.participants,
      (p) => p.fullName,
      ["fullName", "phoneNumberE164", "role"],
    ),
    rooms: compareById(
      previous.rooms,
      draft.rooms,
      (r) => r.roomName,
      [
        "roomName",
        "hotelName",
        "hotelAddress",
        "nearestStation",
        "notes",
        "sortOrder",
      ],
    ),
    groups: compareById(
      previous.groups,
      draft.groups,
      (g) => g.name,
      ["name", "type", "description", "sortOrder"],
    ),
    participantAssignments: comparePairs(
      assignmentsPrev,
      assignmentsNext,
      (r) =>
        "groupId" in r && r.groupId
          ? `Group ${r.groupId.slice(0, 8)}…`
          : `Room ${(r as { roomId: string }).roomId.slice(0, 8)}…`,
    ),
    phraseCategories: compareById(
      previous.phraseCategories,
      draft.phraseCategories,
      (c) => c.name,
      ["name", "sortOrder"],
    ),
    phrases: compareById(
      previous.phrases,
      draft.phrases,
      (p) => p.englishText.slice(0, 60),
      [
        "categoryId",
        "englishText",
        "translatedText",
        "pronunciation",
        "notes",
        "sortOrder",
      ],
    ),
  };
}

export function diffHasChanges(diff: SnapshotDiff): boolean {
  for (const section of Object.values(diff)) {
    if (section.added.length || section.removed.length || section.changed.length) {
      return true;
    }
  }
  return false;
}

export function diffSummaryCounts(diff: SnapshotDiff) {
  const sections: Record<string, { added: number; removed: number; changed: number }> =
    {};
  for (const [key, section] of Object.entries(diff)) {
    sections[key] = {
      added: section.added.length,
      removed: section.removed.length,
      changed: section.changed.length,
    };
  }
  return sections;
}
