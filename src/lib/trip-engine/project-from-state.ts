import type { TripSetupState } from "@/lib/host/setup/types";
import { setupStateToGraph } from "./adapters";
import { projectCalendar, type ProjectCalendarOptions } from "./project-calendar";
import type { CalendarProjection } from "./types";

/** Project calendar from setup state without requiring a persisted trip id. */
export function projectCalendarFromState(
  state: TripSetupState,
  options?: ProjectCalendarOptions,
): CalendarProjection {
  return projectCalendar(setupStateToGraph("local", state), options);
}
