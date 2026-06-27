import type { StayType } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "../types";
import { allTransportLegs, financeSeedTransportLegs } from "./transport-finance-product";
import type { RosterSummary } from "../types";

import { orderFinanceSectionLines } from "./finance-line-chronology";
import { convertToBaseCents } from "./format-money";
import { isFinanceAccommodationStay } from "./finance-accommodation-stay";
import type {
  CostLedgerProjection,
  CostLineItemDraft,
  FinanceBuiltInSection,
  FinanceCalendarSection,
  FinanceCustomSection,
  FinanceViewGroup,
  TripCostSettingsDraft,
} from "./types";
import {
  eligibleParticipantIdsForLine,
  type ParticipantPresenceMap,
} from "./presence";

export type { FinanceBuiltInSection, FinanceCalendarSection };

/** Built-in logistics tabs plus custom section ids (uuid strings). */
export type FinanceEntitySection = FinanceBuiltInSection | string;

/** Scope for finance exports — whole trip or one section tab. */
export type FinanceExportScope = "all" | FinanceEntitySection;

export const FINANCE_CALENDAR_SECTIONS: FinanceCalendarSection[] = [
  "accommodation",
  "transport",
  "activities",
];

export const FINANCE_BUILTIN_SECTIONS: FinanceBuiltInSection[] = [
  ...FINANCE_CALENDAR_SECTIONS,
  "other",
];

export const FINANCE_OTHER_SECTION: FinanceBuiltInSection = "other";

/** @deprecated use FINANCE_BUILTIN_SECTIONS */
export const FINANCE_ENTITY_SECTIONS = FINANCE_BUILTIN_SECTIONS;

export const FINANCE_SECTION_LABELS: Record<FinanceBuiltInSection, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  activities: "Activities",
  other: "Other",
};

export const FINANCE_SECTION_DESCRIPTIONS: Record<FinanceBuiltInSection, string> = {
  accommodation: "Hotels, hostels, homestays, and group stays",
  transport: "Flights, trains, buses, and intercity legs",
  activities: "Scheduled activities and events",
  other: "Fees, meals, insurance, and other trip costs not on the calendar",
};

export function financeSectionList(settings?: TripCostSettingsDraft): FinanceEntitySection[] {
  const custom = settings?.financeCustomSections?.map((s) => s.id) ?? [];
  return [...FINANCE_BUILTIN_SECTIONS, ...custom];
}

export function financeSectionLabel(
  section: FinanceEntitySection,
  settings?: TripCostSettingsDraft,
): string {
  if (section in FINANCE_SECTION_LABELS) {
    return FINANCE_SECTION_LABELS[section as FinanceBuiltInSection];
  }
  return (
    settings?.financeCustomSections?.find((s) => s.id === section)?.name ?? "Section"
  );
}

export function financeSectionExpensesLabel(
  section: FinanceEntitySection,
  settings?: TripCostSettingsDraft,
): string {
  return `${financeSectionLabel(section, settings)} expenses`;
}

export function financeSectionFundingLabel(
  section: FinanceEntitySection,
  settings?: TripCostSettingsDraft,
): string {
  return `${financeSectionLabel(section, settings)} funding`;
}

export function financeSectionDescription(
  section: FinanceEntitySection,
  settings?: TripCostSettingsDraft,
): string {
  if (section in FINANCE_SECTION_DESCRIPTIONS) {
    return FINANCE_SECTION_DESCRIPTIONS[section as FinanceBuiltInSection];
  }
  const custom = settings?.financeCustomSections?.find((s) => s.id === section);
  return custom?.description?.trim() || "Custom trip costs";
}

export function isFinanceBuiltInSection(section: string): section is FinanceBuiltInSection {
  return FINANCE_BUILTIN_SECTIONS.includes(section as FinanceBuiltInSection);
}

export function isFinanceCustomSection(
  sectionId: string,
  settings?: TripCostSettingsDraft,
): boolean {
  if (isFinanceBuiltInSection(sectionId)) return false;
  return Boolean(settings?.financeCustomSections?.some((section) => section.id === sectionId));
}

export function isFinanceCalendarSection(section: string): section is FinanceCalendarSection {
  return FINANCE_CALENDAR_SECTIONS.includes(section as FinanceCalendarSection);
}

/** Manual expense lines (+ button) — Other tab and any custom sections. */
export function supportsManualExpenseLines(section: string): boolean {
  return section === FINANCE_OTHER_SECTION || !isFinanceCalendarSection(section);
}

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

export function isManualFinanceLine(line: CostLineItemDraft): boolean {
  return (
    !line.linkedStayId &&
    !line.linkedTransportLegId &&
    !line.linkedActivityId &&
    Boolean(line.allocationRulePayload.financeSection)
  );
}

export function financeSectionForLine(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
  settings?: TripCostSettingsDraft,
): FinanceEntitySection | null {
  if (line.linkedStayId) {
    if (!linkedStayIsFinanceEligible(line, graph)) return null;
    return "accommodation";
  }
  if (line.linkedTransportLegId) return "transport";
  if (line.linkedActivityId) return "activities";
  const manualSection = line.allocationRulePayload.financeSection;
  if (manualSection) {
    if (isFinanceBuiltInSection(manualSection)) return manualSection;
    if (settings?.financeCustomSections?.some((s) => s.id === manualSection)) {
      return manualSection;
    }
    return FINANCE_OTHER_SECTION;
  }
  if (
    !line.linkedStayId &&
    !line.linkedTransportLegId &&
    !line.linkedActivityId &&
    (line.category === "insurance" || /\binsurance\b/i.test(line.description))
  ) {
    return "transport";
  }
  if (line.category === "accommodation") return "accommodation";
  if (line.category === "transport" || line.category === "flights") return "transport";
  if (line.category === "activities") return "activities";
  return null;
}

/** Hide stale per-leg transport rows covered by a pass/product or duplicate route seed. */
export function isVisibleTransportFinanceLine(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): boolean {
  if (!line.linkedTransportLegId || !graph) return true;
  const leg = allTransportLegs(graph).find((row) => row.id === line.linkedTransportLegId);
  if (!leg) return true;
  if (leg.transportProductId) return false;
  return financeSeedTransportLegs(graph).some((row) => row.id === leg.id);
}

export function groupLinesByFinanceSection(
  lines: CostLineItemDraft[],
  graph?: TripEntityGraph | null,
  settings?: TripCostSettingsDraft,
): Map<FinanceEntitySection, CostLineItemDraft[]> {
  const sections = financeSectionList(settings);
  const grouped = new Map<FinanceEntitySection, CostLineItemDraft[]>(
    sections.map((s) => [s, []]),
  );
  for (const line of lines) {
    if (!isVisibleTransportFinanceLine(line, graph)) continue;
    const section = financeSectionForLine(line, graph, settings);
    if (!section) continue;
    if (!grouped.has(section)) {
      grouped.set(section, []);
    }
    grouped.get(section)!.push(line);
  }
  for (const section of sections) {
    const bucket = grouped.get(section) ?? [];
    grouped.set(section, orderFinanceSectionLines(bucket, graph));
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
  if (stay.stayType === "homestay") {
    return {
      preposition: "in a",
      label: `${stay.cityLabel || "city"} homestay`.trim(),
    };
  }
  if (stay.stayType === "hostel") {
    return {
      preposition: "in a",
      label: `${stay.cityLabel || "city"} hostel`.trim(),
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

/** Trip gross limited to finance grid lines. */
export function logisticsGrossForParticipant(
  lines: CostLineItemDraft[],
  participantId: string,
  allocationByLine: Map<string, Record<string, number>>,
  settings: CostLedgerProjection["settings"],
  graph?: TripEntityGraph | null,
): number {
  const logistics = lines.filter(
    (l) => financeSectionForLine(l, graph, settings) != null,
  );
  return sectionTotalForParticipant(logistics, participantId, allocationByLine, settings);
}

export type { FinanceCustomSection, FinanceViewGroup };
