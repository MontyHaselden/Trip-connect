import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import { computeTripWarnings } from "@/lib/host/trip-warnings";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { detectGroupCityMoves } from "@/lib/groups/detect-group-city-moves";
import type { PublishedTripSnapshotV1 } from "@/types/published-trip";

import {
  effectiveTripBoundsFromState,
  uncoveredTripDays,
} from "@/lib/host/setup/sync-trip-bounds";
import type { SetupReadinessStatus, SetupSectionReadiness, TripSetupState } from "./setup/types";

function worstStatus(
  statuses: SetupReadinessStatus[],
  emptyDefault: SetupReadinessStatus = "todo",
): SetupReadinessStatus {
  if (!statuses.length) return emptyDefault;
  const order: SetupReadinessStatus[] = [
    "conflict",
    "decision",
    "todo",
    "flexible",
    "complete",
    "idle",
  ];
  for (const s of order) {
    if (statuses.includes(s)) return s;
  }
  return emptyDefault;
}

function bookingToStatus(status: string | null | undefined): SetupReadinessStatus {
  if (status === "booked") return "complete";
  if (status === "flexible") return "flexible";
  if (status === "placeholder") return "flexible";
  if (status === "not_booked") return "todo";
  return "todo";
}

export async function computeSetupReadiness(
  tripId: string,
  state: TripSetupState,
  snapshot?: PublishedTripSnapshotV1 | null,
): Promise<SetupSectionReadiness[]> {
  const gaps = await analyzeImportGaps(tripId);
  const warnings = snapshot ? computeTripWarnings(snapshot) : [];
  const conflictWarnings = warnings.filter((w) => w.severity === "error");
  const todoWarnings = warnings.filter((w) => w.severity === "warning");

  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const tripBounds = effectiveTripBoundsFromState(state);
  const uncovered = uncoveredTripDays(
    mainDays,
    tripBounds.startDate,
    tripBounds.endDate,
  );
  const hasPlannedDays = mainDays.some((d) => d.primaryCity.trim());

  const transportStatuses = [
    ...state.outboundLegs,
    ...state.returnLegs,
    ...state.intercityLegs,
  ].map((l) => bookingToStatus(l.bookingStatus));

  const stayStatuses = state.accommodationStays.map((s) =>
    s.stayType === "not_booked" || !s.name?.trim() ? "todo" : ("complete" as SetupReadinessStatus),
  );

  const groupMoves = state.groups
    .filter((g) => !g.isMain)
    .flatMap((g) => {
      const groupDays = state.dayPlacesByGroupId[g.id] ?? [];
      return detectGroupCityMoves(mainDays, groupDays, false);
    });

  const overviewStatus: SetupReadinessStatus = conflictWarnings.length
    ? "conflict"
    : tripNameNeedsAttention(state.basics.name)
      ? "todo"
      : "complete";

  const locationsReady = hasPlannedDays && uncovered.length === 0;

  const accommodationStatus: SetupReadinessStatus =
    stayStatuses.length === 0
      ? "todo"
      : worstStatus(stayStatuses);

  const transportStatus: SetupReadinessStatus =
    transportStatuses.length === 0
      ? "todo"
      : groupMoves.length
        ? "todo"
        : worstStatus(transportStatuses);

  const publishStatus: SetupReadinessStatus = conflictWarnings.length
    ? "conflict"
    : todoWarnings.length
      ? "decision"
      : gaps.length ||
          tripNameNeedsAttention(state.basics.name) ||
          !locationsReady ||
          accommodationStatus !== "complete" ||
          transportStatus !== "complete"
        ? "todo"
        : "complete";

  const sections: SetupSectionReadiness[] = [
    {
      id: "overview",
      label: "Overview",
      status: overviewStatus,
      message: tripNameNeedsAttention(state.basics.name)
        ? "Name this trip"
        : conflictWarnings[0]?.message,
    },
    {
      id: "locations",
      label: "Locations",
      status: locationsReady ? "complete" : hasPlannedDays ? "flexible" : "todo",
      message: uncovered.length
        ? `${uncovered.length} day${uncovered.length === 1 ? "" : "s"} still need a location`
        : hasPlannedDays
          ? undefined
          : "Paint where the group stays on the calendar",
    },
    {
      id: "accommodation",
      label: "Accommodation",
      status: accommodationStatus,
      message:
        stayStatuses.length === 0
          ? "Add accommodation stays"
          : accommodationStatus === "todo"
            ? "Confirm accommodation details"
            : undefined,
    },
    {
      id: "transport",
      label: "Transport",
      status: transportStatus,
      message:
        transportStatuses.length === 0
          ? "Add outbound, return, or intercity legs"
          : groupMoves.length
            ? `Missing transport for ${groupMoves.length} group city change(s)`
            : transportStatus === "todo"
              ? "Confirm transport bookings"
              : undefined,
    },
    {
      id: "activities",
      label: "Activities",
      status: "todo",
      message: "Add activities",
    },
    {
      id: "groups",
      label: "Groups",
      status: "todo",
      message: "Review groups and overlays",
    },
    {
      id: "participants",
      label: "Participants",
      status: "todo",
      message: "Invite and assign participants",
    },
    {
      id: "bookings",
      label: "Bookings & references",
      status: "todo",
      message: "Add booking references",
    },
    {
      id: "emergency",
      label: "Emergency",
      status: "todo",
      message: "Add emergency contacts",
    },
    {
      id: "photos_viewers",
      label: "Photos/viewers",
      status: "todo",
      message: "Configure photos and viewers",
    },
    {
      id: "publish",
      label: "Publish",
      status: publishStatus,
      message:
        publishStatus === "conflict"
          ? conflictWarnings[0]?.message
          : publishStatus === "decision"
            ? todoWarnings[0]?.message
            : publishStatus === "todo"
              ? gaps[0]?.message ?? "Finish setup sections first"
              : undefined,
    },
  ];

  return sections;
}
