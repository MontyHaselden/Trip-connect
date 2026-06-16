import type { TripPlaceContext } from "@/lib/host/setup/home-locks";
import {
  isCalendarDayInteractive,
  isCalendarDaySelectable,
} from "@/lib/host/wizard/transport-day-placement";
import type { CalendarDaySegment } from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { CalendarRenderModel } from "@/lib/trip-engine/types";

export function tripContextFromModel(model: CalendarRenderModel): TripPlaceContext {
  return {
    startDate: model.tripStart,
    endDate: model.tripEnd,
    departureCity: model.departureCity,
    returnCity: model.returnCity,
  };
}

export function emptyGridDay(iso: string): DayPlaceDraft {
  return {
    date: iso,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

export function isTripOsDaySelectable(input: {
  iso: string;
  model: CalendarRenderModel;
  day: DayPlaceDraft | null | undefined;
  travelSegments?: CalendarDaySegment[];
}): boolean {
  const { iso, model, day, travelSegments } = input;
  if (iso < model.interactionStart || iso > model.gridEnd) return false;
  return isCalendarDaySelectable({
    iso,
    trip: tripContextFromModel(model),
    day: day ?? emptyGridDay(iso),
    travelSegments,
    paintStart: model.interactionStart,
    paintEnd: model.gridEnd,
  });
}

export function isTripOsDayInteractive(input: {
  iso: string;
  model: CalendarRenderModel;
  day: DayPlaceDraft | null | undefined;
  travelSegments?: CalendarDaySegment[];
}): boolean {
  const { iso, model, day, travelSegments } = input;
  if (iso < model.interactionStart || iso > model.gridEnd) return false;
  return isCalendarDayInteractive({
    iso,
    trip: tripContextFromModel(model),
    day: day ?? emptyGridDay(iso),
    travelSegments,
    paintStart: model.interactionStart,
    paintEnd: model.gridEnd,
  });
}
