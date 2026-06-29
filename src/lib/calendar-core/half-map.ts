import type { HalfSide } from "@/lib/host/wizard/location-stays";

import type { HalfSelection } from "./types";

/** Map UI half sides (left/right) to canonical slice halves (am/pm). */
export function normalizeHalfSelection(
  half: HalfSide | HalfSelection | "full",
): HalfSelection {
  if (half === "left" || half === "am") return "am";
  if (half === "right" || half === "pm") return "pm";
  return "full";
}

export function halfSideToSelection(half: HalfSide | "full"): HalfSelection {
  return normalizeHalfSelection(half);
}

export function selectionHalfToSide(half: HalfSelection): HalfSide | "full" {
  if (half === "am") return "left";
  if (half === "pm") return "right";
  return "full";
}
