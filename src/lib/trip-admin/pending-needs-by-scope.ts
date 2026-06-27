import {
  hiddenPendingTransportNeedsFromCalendar,
  pendingTransportNeedsFromCalendar,
  type PendingTransportNeed,
} from "@/lib/trip-engine/pending-city-moves";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

export function pendingTransportForScope(
  graph: TripEntityGraph,
  groupId: string,
): PendingTransportNeed[] {
  return pendingTransportNeedsFromCalendar(graph, groupId);
}

export function hiddenPendingTransportForScope(
  graph: TripEntityGraph,
  groupId: string,
): PendingTransportNeed[] {
  return hiddenPendingTransportNeedsFromCalendar(graph, groupId);
}
