import { findTransportLegOnDay } from "@/lib/host/setup/transport-drag-warnings";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { CalendarDaySegment } from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft, TransportLegDraft } from "@/lib/host/wizard/types";

import type { TripSetupState } from "./types";

/** Whether a horizontal click ratio falls inside a painted transit segment. */
export function clickHitsTransitSegment(
  clickRatio: number,
  segments: CalendarDaySegment[] | undefined,
): boolean {
  if (!segments?.length) return false;
  const margin = 0.01;
  return segments.some(
    (segment) =>
      segment.kind === "transit" &&
      clickRatio >= segment.start - margin &&
      clickRatio <= segment.end + margin,
  );
}

export function transportLegDateSpan(leg: TransportLegDraft): {
  start: string;
  end: string;
} | null {
  const start = leg.travelDate?.trim();
  if (!start) return null;
  const end = arrivalDate(leg);
  return { start, end };
}

export function findTransportLegForCalendarClick(
  state: Pick<
    TripSetupState,
    "outboundLegs" | "returnLegs" | "intercityLegs"
  >,
  iso: string,
  day?: DayPlaceDraft,
): TransportLegDraft | undefined {
  return findTransportLegOnDay(state, iso, day);
}
