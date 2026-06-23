import { detectCityMoves, type CityMove } from "@/lib/host/wizard/detect-city-moves";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import type { IntercityLegDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

import { dayPlacesForGroup } from "./selectors";
import type { TripEntityGraph } from "./types";

function legCoversMove(leg: IntercityLegDraft, move: CityMove): boolean {
  const kind = leg.legKind ?? "city_change";
  if (kind !== "city_change") return false;
  return (
    leg.travelDate === move.date &&
    locationsMatch(leg.intercityFromCity, move.fromCity) &&
    locationsMatch(leg.intercityToCity, move.toCity)
  );
}

/** City changes painted on the calendar that still need a transport leg. */
export function pendingCityMovesFromCalendar(
  graph: TripEntityGraph,
  groupId: string,
): CityMove[] {
  const dayPlaces = dayPlacesForGroup(graph, groupId);
  const moves = detectCityMoves(dayPlaces);
  const intercity = graph.intercityLegs.filter((leg) =>
    groupId === graph.mainGroupId
      ? !leg.originGroupId || leg.originGroupId === graph.mainGroupId
      : leg.originGroupId === groupId,
  );
  return moves.filter((move) => !intercity.some((leg) => legCoversMove(leg, move)));
}

export function cityMoveToPlaceholderLeg(
  move: CityMove,
  groupId: string,
): IntercityLegDraft {
  return {
    id: newId(),
    transportType: "unsure",
    bookingStatus: "flexible",
    travelDate: move.date,
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: move.fromCity,
    toCity: move.toCity,
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    intercityFromCity: move.fromCity,
    intercityToCity: move.toCity,
    legKind: "city_change",
    originGroupId: groupId,
    sourceEntityId: null,
  };
}
