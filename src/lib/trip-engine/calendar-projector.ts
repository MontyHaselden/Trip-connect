export { projectCalendar, type ProjectCalendarOptions } from "./project-calendar";

export type { DerivedCalendarState } from "@/lib/host/setup/derive-calendar";

import { projectCalendar } from "./project-calendar";
import type { TripEntityGraph } from "./types";

/** Main-group projection with named stays only — used for accommodation bands. */
export function projectMainCalendar(graph: TripEntityGraph) {
  return projectCalendar(graph, { groupId: graph.mainGroupId });
}
