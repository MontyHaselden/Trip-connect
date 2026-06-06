export const ACTIVITY_CATEGORIES = [
  "travel",
  "meal",
  "school",
  "activity",
  "free_time",
  "hotel",
  "meeting",
  "important",
  "other",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export type DayWeatherSnapshot = {
  locationQuery: string;
  tempC: number | null;
  condition: string | null;
  advice: string | null;
  status: "available" | "too_far" | "unavailable";
  fetchedAt: string;
};
