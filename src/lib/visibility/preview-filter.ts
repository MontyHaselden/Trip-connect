import type { ItineraryItem } from "@/components/host/itinerary/types";
import { isVisibleToParticipant } from "@/lib/visibility/resolve-visible";
import type {
  ParticipantVisibilityContext,
  PublishedVisibilityTarget,
} from "@/lib/visibility/types";
import { targetsForEntity } from "@/lib/visibility/types";

export type PreviewMode =
  | { kind: "everyone" }
  | { kind: "group"; groupId: string }
  | { kind: "participant"; participantId: string; role: "student" | "helper" | "teacher" | "host"; groupIds: string[]; roomId: string | null };

export function previewContext(mode: PreviewMode): ParticipantVisibilityContext | null {
  if (mode.kind === "everyone") return null;
  if (mode.kind === "group") {
    return {
      participantId: "preview",
      role: "student",
      groupIds: new Set([mode.groupId]),
      roomId: null,
    };
  }
  return {
    participantId: mode.participantId,
    role: mode.role,
    groupIds: new Set(mode.groupIds),
    roomId: mode.roomId,
  };
}

export function filterItineraryForPreview(
  items: ItineraryItem[],
  mode: PreviewMode,
  visibilityTargets: PublishedVisibilityTarget[] = [],
): ItineraryItem[] {
  if (mode.kind === "everyone") return items;
  const ctx = previewContext(mode);
  if (!ctx) return items;

  return items.filter((item) =>
    isVisibleToParticipant(
      {
        id: item.id,
        visibilityMode: item.visibilityMode ?? "everyone",
        audienceType: item.audienceType,
        audienceId: item.audienceId,
      },
      ctx,
      targetsForEntity("itinerary_item", item.id, visibilityTargets),
    ),
  );
}
