import { addDays, type HalfSide } from "@/lib/host/wizard/location-stays";

export type NightPairSelection = {
  rangeStart: string;
  rangeEnd: string;
  startHalf: HalfSide | "full";
  endHalf: HalfSide | "full";
};

/** Evening (right) on date N pairs with morning (left) on N+1 for the same night. */
export function pairedHalf(date: string, half: HalfSide): { date: string; half: HalfSide } {
  if (half === "right") return { date: addDays(date, 1), half: "left" };
  return { date: addDays(date, -1), half: "right" };
}

/** Expand a single half-day click to the full night span (evening + next morning). */
export function expandSelectionToNightPair(input: NightPairSelection): NightPairSelection {
  const end = input.rangeEnd || input.rangeStart;
  if (input.rangeStart !== end) return input;
  if (input.startHalf === "full" && input.endHalf === "full") return input;

  const half = input.startHalf === "full" ? input.endHalf : input.startHalf;
  if (half === "full") return input;

  const mate = pairedHalf(input.rangeStart, half);
  if (half === "right") {
    return {
      rangeStart: input.rangeStart,
      rangeEnd: mate.date,
      startHalf: "right",
      endHalf: "left",
    };
  }
  return {
    rangeStart: mate.date,
    rangeEnd: input.rangeStart,
    startHalf: "right",
    endHalf: "left",
  };
}

/** Night date used for stay check-in/out edits when selection is a night pair. */
export function nightDatesForRemoval(selection: NightPairSelection): {
  rangeStart: string;
  rangeEnd: string;
} {
  const expanded = expandSelectionToNightPair(selection);
  if (
    expanded.startHalf === "right" &&
    expanded.endHalf === "left" &&
    addDays(expanded.rangeStart, 1) === expanded.rangeEnd
  ) {
    return { rangeStart: expanded.rangeStart, rangeEnd: expanded.rangeStart };
  }
  return { rangeStart: expanded.rangeStart, rangeEnd: expanded.rangeEnd };
}

export function isSingleNightPairSelection(selection: NightPairSelection): boolean {
  const expanded = expandSelectionToNightPair(selection);
  return (
    expanded.startHalf === "right" &&
    expanded.endHalf === "left" &&
    addDays(expanded.rangeStart, 1) === expanded.rangeEnd
  );
}

export function formatCalendarSelectionLabel(selection: NightPairSelection): string {
  const end = selection.rangeEnd || selection.rangeStart;
  if (selection.rangeStart === end) {
    if (selection.startHalf === "full" && selection.endHalf === "full") {
      return selection.rangeStart;
    }
    const half =
      selection.startHalf === "left"
        ? "first half"
        : selection.startHalf === "right"
          ? "second half"
          : selection.endHalf === "left"
            ? "first half"
            : selection.endHalf === "right"
              ? "second half"
              : "";
    return half ? `${selection.rangeStart} · ${half}` : selection.rangeStart;
  }

  const startLabel =
    selection.startHalf === "right"
      ? `${selection.rangeStart} second half`
      : selection.startHalf === "left"
        ? `${selection.rangeStart} first half`
        : selection.rangeStart;
  const endLabel =
    selection.endHalf === "left"
      ? `${end} first half`
      : selection.endHalf === "right"
        ? `${end} second half`
        : end;
  return `${startLabel} → ${endLabel}`;
}

export function formatNightPairLabel(selection: NightPairSelection): string {
  const expanded = expandSelectionToNightPair(selection);
  const end = expanded.rangeEnd || expanded.rangeStart;

  if (expanded.rangeStart === end) {
    if (expanded.startHalf === "full") return expanded.rangeStart;
    const half =
      expanded.startHalf === "left" ? "first half" : expanded.startHalf === "right" ? "second half" : "";
    return half ? `${expanded.rangeStart} · ${half}` : expanded.rangeStart;
  }

  const startLabel =
    expanded.startHalf === "right"
      ? `${expanded.rangeStart} second half`
      : expanded.startHalf === "left"
        ? `${expanded.rangeStart} first half`
        : expanded.rangeStart;
  const endLabel =
    expanded.endHalf === "left"
      ? `${end} first half`
      : expanded.endHalf === "right"
        ? `${end} second half`
        : end;
  return `${startLabel} → ${endLabel}`;
}
