import { locationPaletteKey, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { TripEntityGraph } from "../types";
import { stayNightDates } from "../match-main-accommodation-stay";
import {
  citiesForParticipantOnDate,
  type ResolvedParticipantPlan,
} from "../resolve-participant-graph";
import type { CostLineItemDraft } from "./types";

export function countStayNights(checkIn: string, checkOut: string): number {
  return stayNightDates(checkIn, checkOut).length;
}

export function nightsLabel(nights: number): string {
  if (nights === 1) return "1 night";
  return `${nights} nights`;
}

export function perNightCents(totalCents: number, nights: number): number | null {
  if (nights <= 0 || totalCents <= 0) return null;
  return Math.round(totalCents / nights);
}

export function participantNightsAtStay(
  plan: ResolvedParticipantPlan,
  stay: { cityLabel: string; checkInDate: string; checkOutDate: string },
): number {
  const stayCity = locationPaletteKey(stay.cityLabel);
  if (!stayCity) return 0;

  let nights = 0;
  for (const date of stayNightDates(stay.checkInDate, stay.checkOutDate)) {
    const cities = citiesForParticipantOnDate(plan, date);
    const atStay = cities.some(
      (city) => locationsMatch(city, stayCity) || city === stayCity,
    );
    if (atStay) nights += 1;
  }
  return nights;
}

export function stayForLine(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): TripEntityGraph["accommodationStays"][number] | null {
  if (!line.linkedStayId || !graph) return null;
  return graph.accommodationStays.find((stay) => stay.id === line.linkedStayId) ?? null;
}

export function effectiveStayNights(
  line: CostLineItemDraft,
  graph?: TripEntityGraph | null,
): number | null {
  const stay = stayForLine(line, graph);
  if (!stay) return line.quantity;
  if (line.quantity != null && line.quantity > 0) return line.quantity;
  const nights = countStayNights(stay.checkInDate, stay.checkOutDate);
  return nights > 0 ? nights : null;
}

export function participantNightsForLine(
  line: CostLineItemDraft,
  participantId: string,
  graph: TripEntityGraph,
  presence: Map<string, ResolvedParticipantPlan>,
): number | null {
  const stay = stayForLine(line, graph);
  if (!stay) return null;
  const plan = presence.get(participantId);
  if (!plan) return null;
  return participantNightsAtStay(plan, stay);
}

/** Split a row total across participants proportional to their night counts. */
export function splitByNightUnits(
  totalCents: number,
  nightUnits: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(nightUnits).filter(([, nights]) => nights > 0);
  const totalNights = entries.reduce((sum, [, nights]) => sum + nights, 0);
  if (!entries.length || !totalNights || totalCents === 0) {
    return Object.fromEntries(entries.map(([id]) => [id, 0]));
  }

  let allocated = 0;
  const out: Record<string, number> = {};
  for (let i = 0; i < entries.length; i++) {
    const [id, nights] = entries[i]!;
    if (i === entries.length - 1) {
      out[id] = totalCents - allocated;
      continue;
    }
    const share = Math.round((totalCents * nights) / totalNights);
    out[id] = share;
    allocated += share;
  }
  return out;
}

export function splitWithPinnedOverridesByNights(
  totalCents: number,
  eligibleParticipantIds: string[],
  pinnedOverrides: Record<string, number>,
  nightUnits: Record<string, number>,
): Record<string, number> {
  if (!eligibleParticipantIds.length) return {};

  const pinnedIds = eligibleParticipantIds.filter((id) => pinnedOverrides[id] != null);
  const pinnedSum = pinnedIds.reduce((sum, id) => sum + pinnedOverrides[id]!, 0);
  const unpinnedIds = eligibleParticipantIds.filter((id) => !pinnedIds.includes(id));

  const allocations: Record<string, number> = {};
  for (const id of pinnedIds) {
    allocations[id] = pinnedOverrides[id]!;
  }

  const unpinnedNights = Object.fromEntries(
    unpinnedIds.map((id) => [id, nightUnits[id] ?? 0]),
  );
  Object.assign(
    allocations,
    splitByNightUnits(Math.max(0, totalCents - pinnedSum), unpinnedNights),
  );
  return allocations;
}
