import { dayPlacesForGroup } from "./selectors";
import type { TripEntityGraph } from "./types";

export function calendarHasPaint(graph: TripEntityGraph, groupId: string): boolean {
  return dayPlacesForGroup(graph, groupId).some(
    (day) =>
      day.primaryCity.trim().length > 0 ||
      (day.secondaryCity?.trim() ?? "").length > 0,
  );
}
