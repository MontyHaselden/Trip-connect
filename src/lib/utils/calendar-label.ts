import { shortDayLabel } from "@/lib/utils/time";

type CalendarDay = {
  date: string;
  cityLabel: string;
  calendarLabel?: string | null;
};

type TripDates = {
  startDate: string;
  endDate: string;
};

export function resolveCalendarLabel(
  day: CalendarDay,
  trip: TripDates,
  firstItemTitle?: string | null,
): string {
  if (day.calendarLabel?.trim()) {
    return shortDayLabel(day.calendarLabel.trim(), 9);
  }
  if (day.date < trip.startDate) {
    if (firstItemTitle) {
      const t = firstItemTitle.trim();
      if (/meeting/i.test(t)) return "Meeting";
      return shortDayLabel(t, 9);
    }
    return "Meeting";
  }
  if (day.date === trip.startDate) return "Depart";
  if (day.date === trip.endDate) return "Return";
  return shortDayLabel(day.cityLabel, 9);
}

export function isPreTripDay(day: CalendarDay, trip: TripDates): boolean {
  return day.date < trip.startDate;
}
