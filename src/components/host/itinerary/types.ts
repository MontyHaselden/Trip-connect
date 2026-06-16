import type { ActivityCategory } from "@/types/activity-category";

export type ItineraryItem = {
  id: string;
  tripDayId: string;
  startTime: string;
  endTime: string | null;
  title: string;
  locationName: string | null;
  address: string | null;
  mapQuery: string | null;
  leaveByTime: string | null;
  transportNote: string | null;
  bringNote: string | null;
  hostNote: string | null;
  audienceType: "everyone" | "group" | "room" | "participant";
  audienceId: string | null;
  visibilityMode?: "everyone" | "staff_only" | "viewers_only" | "hidden_from_students" | "custom";
  category: ActivityCategory | null;
  sortOrder: number;
};

import type { VisibilityMode, VisibilityTarget } from "@/lib/visibility/types";

export type PrepItem = {
  id: string;
  tripDayId: string;
  text: string;
  sortOrder: number;
  visibilityMode?: VisibilityMode;
  targets?: VisibilityTarget[];
};

export type TripDay = {
  id: string;
  date: string;
  cityLabel: string;
  calendarLabel: string | null;
  summary: string | null;
  sortOrder: number;
  items: ItineraryItem[];
  prep: PrepItem[];
};

export type ItineraryTree = { days: TripDay[] };

export type RosterSummary = {
  rooms: { id: string; roomName: string }[];
  groups: { id: string; name: string; type?: string }[];
  participants: { id: string; fullName: string; role?: string }[];
};

export function timeToInput(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}
