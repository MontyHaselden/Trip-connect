import type { TripMapCategory } from "@/lib/trip-engine/map-types";
import { MAP_MARKER_COLORS } from "@/lib/trip-engine/project-trip-map";

export { MAP_MARKER_COLORS };

export const MAP_CATEGORY_LABELS: Record<TripMapCategory, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  activities: "Activities",
  locations: "Locations",
};

export const ALL_MAP_CATEGORIES: TripMapCategory[] = [
  "accommodation",
  "transport",
  "activities",
  "locations",
];

export function categoryIcon(category: TripMapCategory): string {
  switch (category) {
    case "accommodation":
      return "🏨";
    case "transport":
      return "✈";
    case "activities":
      return "★";
    case "locations":
      return "📍";
  }
}
