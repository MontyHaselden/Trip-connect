import type { StayType } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "../types";
import type { RosterSummary } from "../types";

import { convertToBaseCents } from "./format-money";
import { isFinanceAccommodationStay } from "./finance-accommodation-stay";
import type { CostLedgerProjection, CostLineItemDraft } from "./types";
import {
  eligibleParticipantIdsForLine,
  type ParticipantPresenceMap,
} from "./presence";

/** Finance grid only shows trip logistics — not locations or misc buckets. */
export type FinanceEntitySection = "accommodation" | "transport" | "activities";

export const FINANCE_ENTITY_SECTIONS: FinanceEntitySection[] = [
  "accommodation",
  "transport",
  "activities",
];

export const FINANCE_SECTION_LABELS: Record<FinanceEntitySection, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  activities: "Activities",
};

export const FINANCE_SECTION_DESCRIPTIONS: Record<FinanceEntitySection, string> = {
  accommodation: "Hotels, hostels, homestays, and group stays",
  transport: "Flights, trains, buses, and intercity legs",
  activities: "Scheduled activities and events",
};

function linkedStayIsFinanceEligible(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): boolean {
  if (!line.linkedStayId) return true;
  if (!graph) return true;
  const stay = graph.accommodationStays.find((s) => s.id === line.linkedStayId);
  if (!stay) return false;
  return isFinanceAccommodationStay(stay);
}

export function financeSectionForLine(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): FinanceEntitySection | null {
  if (line.linkedStayId) {
    if (!linkedStayIsFinanceEligible(line, graph)) return null;
    return "accommodation";
  }
  if (line.linkedTransportLegId) return "transport";
  if (line.linkedActivityId) return "activities";
  if (line.category === "accommodation") return "accommodation";
  if (line.category === "transport" || line.category === "flights") return "transport";
  if (line.category === "activities") return "activities";
  return null;
}

export function groupLinesByFinanceSection(
  lines: CostLineItemDraft[],
  graph?: TripEntityGraph | null,
): Map<FinanceEntitySection, CostLineItemDraft[]> {
  const grouped = new Map<FinanceEntitySection, CostLineItemDraft[]>(
    FINANCE_ENTITY_SECTIONS.map((s) => [s, []]),
  );
  for (const line of lines) {
    const section = financeSectionForLine(line, graph);
    if (section) grouped.get(section)!.push(line);
  }
  return grouped;
}

function stayPrepositionAndLabel(stay: {
  stayType: StayType;
  name: string | null;
  cityLabel: string;
}): { preposition: "in a" | "at the"; label: string } {
  if (stay.stayType === "hotel" || stay.stayType === "multiple_hotels") {
    return { preposition: "at the", label: stay.name?.trim() || stay.cityLabel || "stay" };
  }
  if (stay.stayType === "hostel") {
    return {
      preposition: "in a",
      label: `${stay.cityLabel || "city"} hostel`.trim(),
    };
  }
  if (stay.stayType === "homestay") {
    return {
      preposition: "in a",
      label: `${stay.cityLabel || "city"} homestay`.trim(),
    };
  }
  if (stay.stayType === "campground") {
    return {
      preposition: "in a",
      label: `${stay.cityLabel || "city"} campground`.trim(),
    };
  }
  return {
    preposition: "at the",
    label: stay.name?.trim() || stay.cityLabel || "stay",
  };
}

/** Message when a participant is not present for a linked cost line. */
export function absenceMessageForParticipant(
  line: CostLineItemDraft,
  graph: TripEntityGraph,
  roster: RosterSummary,
  presence: ParticipantPresenceMap,
  participantId: string,
): string | null {
  const participant = roster.participants.find((p) => p.id === participantId);
  if (!participant) return null;

  const eligible = eligibleParticipantIdsForLine(line, graph, roster, presence);
  if (eligible.includes(participantId)) return null;

  const firstName = participant.fullName.trim().split(/\s+/)[0] || participant.fullName;

  if (line.linkedStayId) {
    const stay = graph.accommodationStays.find((s) => s.id === line.linkedStayId);
    if (!stay) return `${firstName} is not at this stay during this time.`;
    const { preposition, label } = stayPrepositionAndLabel(stay);
    return `${firstName} is not staying ${preposition} ${label} during this time.`;
  }

  if (line.linkedTransportLegId) {
    const leg = [
      ...graph.outboundLegs,
      ...graph.returnLegs,
      ...graph.intercityLegs,
    ].find((l) => l.id === line.linkedTransportLegId);
    const label =
      (leg?.fromCity && leg?.toCity ? `${leg.fromCity} → ${leg.toCity}` : null) ||
      leg?.fromCity ||
      "this transport";
    return `${firstName} is not on ${label} during this time.`;
  }

  if (line.linkedActivityId) {
    const activity = graph.activities.find((a) => a.id === line.linkedActivityId);
    const label = activity?.title?.trim() || "this activity";
    return `${firstName} is not at ${label} during this time.`;
  }

  return `${firstName} is not on this trip segment during this time.`;
}

export function participantAllocationCents(
  line: CostLineItemDraft,
  participantId: string,
  allocationByLine: Map<string, Record<string, number>>,
  settings: CostLedgerProjection["settings"],
): number {
  const alloc = allocationByLine.get(line.id)?.[participantId];
  if (alloc == null) return 0;
  return convertToBaseCents(alloc, line.currency, settings);
}

/** Sum of a participant's allocated amounts for lines in one finance section. */
export function sectionTotalForParticipant(
  lines: CostLineItemDraft[],
  participantId: string,
  allocationByLine: Map<string, Record<string, number>>,
  settings: CostLedgerProjection["settings"],
): number {
  return lines.reduce(
    (sum, line) =>
      sum + participantAllocationCents(line, participantId, allocationByLine, settings),
    0,
  );
}

/** Trip gross limited to accommodation + transport + activities lines. */
export function logisticsGrossForParticipant(
  lines: CostLineItemDraft[],
  participantId: string,
  allocationByLine: Map<string, Record<string, number>>,
  settings: CostLedgerProjection["settings"],
  graph?: TripEntityGraph | null,
): number {
  const logistics = lines.filter((l) => financeSectionForLine(l, graph) != null);
  return sectionTotalForParticipant(logistics, participantId, allocationByLine, settings);
}
