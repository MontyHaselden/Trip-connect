import { effectiveTripBoundsFromState, uncoveredTripDays } from "@/lib/host/setup/sync-trip-bounds";
import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import { detectGroupCityMoves } from "@/lib/groups/detect-group-city-moves";
import type { SetupSectionId } from "@/lib/host/setup/types";
import type {
  CalendarProjection,
  EngineReadinessStatus,
  EngineSectionReadiness,
  TripEntityGraph,
} from "./types";
import type { CostLedgerProjection } from "./cost-ledger/types";
import { hasUnbalancedLines } from "./cost-ledger/project";
import {
  financeSectionAllocationMessage,
  financeSectionAllocationStatuses,
  type FinanceBuiltInSection,
} from "./cost-ledger/finance-section-readiness";
import { detectGraphConflicts } from "./conflicts";
import { allLegs } from "./selectors";

const SECTION_LABELS: Record<SetupSectionId, string> = {
  overview: "Overview",
  locations: "Locations",
  accommodation: "Accommodation",
  transport: "Transport",
  activities: "Activities",
  groups: "Groups",
  participants: "Participants",
  bookings: "Bookings & references",
  finance: "Finance",
  emergency: "Emergency",
  photos_viewers: "Photos & viewers",
  publish: "Publish",
};

function worstStatus(statuses: EngineReadinessStatus[]): EngineReadinessStatus {
  const order: EngineReadinessStatus[] = [
    "conflict",
    "question",
    "warning",
    "mostly_complete",
    "complete",
    "idle",
  ];
  for (const s of order) {
    if (statuses.includes(s)) return s;
  }
  return "idle";
}

function legBookingStatus(status: string): EngineReadinessStatus {
  if (status === "booked") return "complete";
  if (status === "flexible" || status === "placeholder") return "mostly_complete";
  return "warning";
}

export function computeReadiness(
  graph: TripEntityGraph,
  projection: CalendarProjection,
  costLedger?: CostLedgerProjection | null,
): EngineSectionReadiness[] {
  const conflicts = detectGraphConflicts(graph, projection);
  const blocking = conflicts.filter((c) => c.severity === "blocking");

  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  const bounds = effectiveTripBoundsFromState(graph);
  const uncovered = uncoveredTripDays(mainDays, bounds.startDate, bounds.endDate);
  const hasPlannedDays = mainDays.some((d) => d.primaryCity.trim());

  const stayStatuses = graph.accommodationStays.map((s) =>
    !s.name?.trim() || s.stayType === "not_booked" ? "warning" : ("complete" as EngineReadinessStatus),
  );

  const transportStatuses = allLegs(graph).map((l) => legBookingStatus(l.bookingStatus));
  const missingTimes = allLegs(graph).filter((l) => !l.departureTime?.trim()).length;

  const activityStatus: EngineReadinessStatus =
    graph.activities.length === 0
      ? "warning"
      : graph.activities.every((a) => a.title.trim())
        ? "complete"
        : "mostly_complete";

  const groupMoves = graph.groups
    .filter((g) => !g.isMain)
    .flatMap((g) => detectGroupCityMoves(mainDays, graph.dayPlacesByGroupId[g.id] ?? [], false));

  const bookingWarnings = graph.bookingsSummary.filter((b) => b.bookingStatus === "not_booked").length;

  const overview: EngineReadinessStatus = blocking.length
    ? "conflict"
    : tripNameNeedsAttention(graph.basics.name)
      ? "warning"
      : "complete";

  const locations: EngineReadinessStatus =
    hasPlannedDays && uncovered.length === 0 ? "complete" : "warning";

  const accommodation: EngineReadinessStatus =
    stayStatuses.length === 0 ? "warning" : worstStatus(stayStatuses);

  const transport: EngineReadinessStatus =
    transportStatuses.length === 0
      ? "warning"
      : groupMoves.length
        ? "question"
        : missingTimes > 0
          ? "warning"
          : worstStatus(transportStatuses);

  const groups: EngineReadinessStatus =
    graph.groups.length <= 1 ? "mostly_complete" : groupMoves.length ? "question" : "complete";

  const emergency: EngineReadinessStatus =
    graph.emergencySummary.localEmergencyNumber?.trim() ? "complete" : "warning";

  const publish: EngineReadinessStatus = blocking.length
    ? "conflict"
    : uncovered.length || !hasPlannedDays
      ? "warning"
      : "complete";

  const costs: EngineReadinessStatus = !costLedger
    ? "idle"
    : costLedger.lineItems.length === 0
      ? "warning"
      : hasUnbalancedLines(costLedger)
        ? "warning"
        : "complete";

  const financeAllocationBySection = new Map(
    financeSectionAllocationStatuses(costLedger, graph).map((row) => [row.section, row]),
  );

  function mergeFinanceAllocationStatus(
    section: FinanceBuiltInSection,
    tripStatus: EngineReadinessStatus,
    tripMessage?: string,
  ): { status: EngineReadinessStatus; message?: string } {
    const financeStatus = financeAllocationBySection.get(section);
    if (!financeStatus) {
      return { status: tripStatus, message: tripMessage };
    }

    if (financeStatus.unallocatedCount > 0) {
      const financeMessage = financeSectionAllocationMessage(financeStatus);
      return {
        status: worstStatus([tripStatus, "conflict"]),
        message: tripMessage ? `${tripMessage} · ${financeMessage}` : financeMessage,
      };
    }

    if (financeStatus.tbcCount > 0) {
      const financeMessage = financeSectionAllocationMessage(financeStatus);
      return {
        status: worstStatus([tripStatus, "warning"]),
        message: tripMessage ? `${tripMessage} · ${financeMessage}` : financeMessage,
      };
    }

    return { status: tripStatus, message: tripMessage };
  }

  const accommodationReadiness = mergeFinanceAllocationStatus(
    "accommodation",
    accommodation,
  );
  const transportReadiness = mergeFinanceAllocationStatus("transport", transport, missingTimes ? `${missingTimes} leg(s) missing departure time` : undefined);
  const activitiesReadiness = mergeFinanceAllocationStatus("activities", activityStatus);

  const rows: Array<{ id: SetupSectionId; status: EngineReadinessStatus; message?: string }> = [
    { id: "overview", status: overview },
    {
      id: "locations",
      status: locations,
      message: uncovered.length ? `${uncovered.length} day(s) without a location` : undefined,
    },
    {
      id: "accommodation",
      status: accommodationReadiness.status,
      message: accommodationReadiness.message,
    },
    {
      id: "transport",
      status: transportReadiness.status,
      message: transportReadiness.message,
    },
    { id: "activities", status: activitiesReadiness.status, message: activitiesReadiness.message },
    { id: "groups", status: groups },
    { id: "participants", status: "idle" },
    {
      id: "bookings",
      status: bookingWarnings ? "warning" : graph.bookingsSummary.length ? "complete" : "warning",
    },
    {
      id: "finance",
      status: costs,
      message:
        costLedger && hasUnbalancedLines(costLedger)
          ? "Some cost lines do not balance"
          : undefined,
    },
    { id: "emergency", status: emergency },
    { id: "photos_viewers", status: "idle" },
    { id: "publish", status: publish },
  ];

  return rows.map((r) => ({
    id: r.id,
    label: SECTION_LABELS[r.id],
    status: r.status,
    message: r.message,
  }));
}
