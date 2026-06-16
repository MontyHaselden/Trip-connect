/**
 * Presentation layer for calendar week rows and day cells.
 * Grid rendering currently lives in LocationStayCalendar; TripCalendar delegates there.
 * Extract cell/band markup here when legacy path is retired.
 */
export type TripCalendarGridProps = {
  embedded?: boolean;
  fillHeight?: boolean;
  layout?: "scroll" | "compact";
};

export const TRIP_CALENDAR_GRID_DEFAULTS: TripCalendarGridProps = {
  embedded: true,
  fillHeight: true,
  layout: "scroll",
};
