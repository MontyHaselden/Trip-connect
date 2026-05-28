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
  sortOrder: number;
};

export type PrepItem = {
  id: string;
  tripDayId: string;
  text: string;
  sortOrder: number;
};

export type TripDay = {
  id: string;
  date: string;
  cityLabel: string;
  summary: string | null;
  sortOrder: number;
  items: ItineraryItem[];
  prep: PrepItem[];
};

export type ItineraryTree = { days: TripDay[] };

export type RosterSummary = {
  rooms: { id: string; roomName: string }[];
  groups: { id: string; name: string }[];
  participants: { id: string; fullName: string }[];
};

export function timeToInput(t: string | null): string {
  if (!t) return "";
  return t.slice(0, 5);
}
