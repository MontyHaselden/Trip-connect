import type { ActivityCategory } from "@/types/activity-category";

import type { ActivityMarker } from "./types";

/** Max dots rendered per calendar day (6 × 2). */
export const CALENDAR_ACTIVITY_DOT_LIMIT = 12;
export const CALENDAR_ACTIVITY_DOTS_PER_ROW = 6;

const EXCLUDED_CATEGORIES = new Set<ActivityCategory>([
  "travel",
  "meal",
  "hotel",
  "free_time",
]);

const ROUTINE_TITLE =
  /\b(check[- ]?in|check[- ]?out|checkout|breakfast|brunch|lunch|dinner|supper|travel(?:ing|ling)?|in[- ]flight|airport\s+transfer|hotel\s+transfer|room\s+drop)\b/i;

export type CalendarDotActivityInput = {
  id: string;
  title: string;
  category: string;
};

export function isCalendarDotActivity(activity: CalendarDotActivityInput): boolean {
  const category = activity.category.trim().toLowerCase();
  if (EXCLUDED_CATEGORIES.has(category as ActivityCategory)) return false;

  const title = activity.title.trim();
  if (!title) return false;
  if (ROUTINE_TITLE.test(title)) return false;

  return true;
}

export function filterCalendarDotActivities<T extends CalendarDotActivityInput>(
  activities: T[],
): T[] {
  return activities.filter(isCalendarDotActivity).slice(0, CALENDAR_ACTIVITY_DOT_LIMIT);
}

export function activityToMarker(a: {
  id: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  bookingStatus: string;
}): ActivityMarker {
  return {
    id: a.id,
    title: a.title,
    startTime: a.startTime,
    endTime: a.endTime,
    category: a.category,
    bookingStatus: a.bookingStatus,
  };
}

export function calendarDotActivitiesForDate(
  activities: Array<{
    id: string;
    title: string;
    startTime: string | null;
    endTime: string | null;
    category: string;
    bookingStatus: string;
    date: string;
  }>,
  date: string,
): ActivityMarker[] {
  const onDate = activities.filter((a) => a.date === date);
  return filterCalendarDotActivities(onDate).map(activityToMarker);
}
