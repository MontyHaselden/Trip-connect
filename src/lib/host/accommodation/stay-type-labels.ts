import type { StayType } from "@/lib/host/wizard/types";

/** Stay types hosts pick when adding accommodation from the calendar or stays section. */
export const PICKABLE_STAY_TYPES = [
  "hotel",
  "hostel",
  "homestay",
  "campground",
  "other",
] as const satisfies readonly StayType[];

export type PickableStayType = (typeof PICKABLE_STAY_TYPES)[number];

export function stayTypeLabel(stayType: StayType): string {
  switch (stayType) {
    case "hotel":
      return "Hotel";
    case "hostel":
      return "Hostel";
    case "homestay":
      return "Homestay";
    case "campground":
      return "Campground";
    case "other":
      return "Other";
    case "multiple_hosts":
      return "Multiple host families";
    case "multiple_hotels":
      return "Multiple hotels";
    case "not_booked":
      return "Not booked yet";
  }
}

export function defaultHomestayGroupForType(stayType: StayType): boolean {
  return stayType === "homestay";
}
