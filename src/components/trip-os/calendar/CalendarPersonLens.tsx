"use client";

/** Calendar always edits the whole-group itinerary (finance keeps its own grouping). */
export function CalendarPersonLens() {
  return (
    <p className="text-xs text-zinc-500">
      Editing <span className="font-semibold text-zinc-700">whole group</span> itinerary
    </p>
  );
}
