import type {
  VisibilityEntityType,
  VisibilityMode,
  VisibilityTarget,
} from "@/lib/visibility/types";
import { legacyAudienceFromVisibility } from "@/lib/visibility/resolve-visible";
import { syncEntityVisibility } from "@/lib/visibility/persistence";

export type ItemVisibilityInput = {
  visibilityMode?: VisibilityMode;
  targets?: VisibilityTarget[];
  audienceType?: "everyone" | "group" | "room" | "participant";
  audienceId?: string | null;
};

export function resolveItemVisibility(input: ItemVisibilityInput): {
  visibilityMode: VisibilityMode;
  targets: VisibilityTarget[];
  audienceType: "everyone" | "group" | "room" | "participant";
  audienceId: string | null;
} {
  if (input.visibilityMode) {
    const visibilityMode = input.visibilityMode;
    const targets = visibilityMode === "custom" ? (input.targets ?? []) : [];
    const legacy = legacyAudienceFromVisibility(visibilityMode, targets);
    return {
      visibilityMode,
      targets,
      audienceType: legacy.audienceType,
      audienceId: legacy.audienceId,
    };
  }

  const audienceType = input.audienceType ?? "everyone";
  const audienceId = input.audienceId ?? null;
  if (audienceType === "everyone") {
    return {
      visibilityMode: "everyone",
      targets: [],
      audienceType,
      audienceId: null,
    };
  }

  const targetType =
    audienceType === "group"
      ? "group"
      : audienceType === "participant"
        ? "participant"
        : "room";
  const targets: VisibilityTarget[] = audienceId
    ? [{ targetType, targetId: audienceId }]
    : [];

  return {
    visibilityMode: "custom",
    targets,
    audienceType,
    audienceId,
  };
}

export async function persistEntityVisibility(
  tripId: string,
  entityType: VisibilityEntityType,
  entityId: string,
  visibilityMode: VisibilityMode,
  targets: VisibilityTarget[],
): Promise<void> {
  await syncEntityVisibility(tripId, entityType, entityId, visibilityMode, targets);
}

export async function persistItemVisibility(
  tripId: string,
  itemId: string,
  visibilityMode: VisibilityMode,
  targets: VisibilityTarget[],
): Promise<void> {
  await persistEntityVisibility(tripId, "itinerary_item", itemId, visibilityMode, targets);
}
