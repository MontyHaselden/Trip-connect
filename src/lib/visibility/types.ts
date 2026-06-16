export type VisibilityMode =
  | "everyone"
  | "staff_only"
  | "viewers_only"
  | "hidden_from_students"
  | "custom";

export type VisibilityEntityType =
  | "itinerary_item"
  | "transport_leg"
  | "accommodation_stay"
  | "day_reminder"
  | "prep_item"
  | "contact"
  | "room";

export type VisibilityTargetType = "group" | "participant" | "room";

export type VisibilityTarget = {
  targetType: VisibilityTargetType;
  targetId: string;
};

export type VisibilityEntity = {
  id: string;
  visibilityMode: VisibilityMode;
  /** Legacy single-target audience (used when visibilityMode unset in old data). */
  audienceType?: "everyone" | "group" | "room" | "participant";
  audienceId?: string | null;
};

export type ParticipantVisibilityContext = {
  participantId: string;
  role: "student" | "helper" | "teacher" | "host";
  groupIds: Set<string>;
  roomId: string | null;
  /** ISO date for date-scoped group membership (optional). */
  dateISO?: string;
};

export type PublishedVisibilityTarget = {
  entityType: VisibilityEntityType;
  entityId: string;
  targetType: VisibilityTargetType;
  targetId: string;
};

export function targetsForEntity(
  entityType: VisibilityEntityType,
  entityId: string,
  allTargets: PublishedVisibilityTarget[],
): VisibilityTarget[] {
  return allTargets
    .filter((t) => t.entityType === entityType && t.entityId === entityId)
    .map((t) => ({ targetType: t.targetType, targetId: t.targetId }));
}

export function resolveVisibilityMode(entity: VisibilityEntity): VisibilityMode {
  if (entity.visibilityMode) return entity.visibilityMode;
  if (!entity.audienceType || entity.audienceType === "everyone") return "everyone";
  return "custom";
}
