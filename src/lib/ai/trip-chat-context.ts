import { shortCity } from "@/lib/host/wizard/analyze-import-gaps";
import { enumerateDates, inferStaysFromDayPlaces } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import { dayPlacesForGroup, legsForGroup, staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

function dayLabel(day: DayPlaceDraft): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (secondary && day.dayType === "travel") {
    return `${shortCity(primary)} → ${shortCity(secondary)}`;
  }
  if (primary) return shortCity(primary);
  return "(empty)";
}

function paintedDateSpan(dayPlaces: DayPlaceDraft[]): { first: string | null; last: string | null } {
  const painted = dayPlaces.filter(
    (day) => day.primaryCity.trim() || day.secondaryCity?.trim(),
  );
  if (!painted.length) return { first: null, last: null };
  const dates = painted.map((day) => day.date).sort((a, b) => a.localeCompare(b));
  return { first: dates[0] ?? null, last: dates[dates.length - 1] ?? null };
}

export function findUnpaintedTripDays(
  dayPlaces: DayPlaceDraft[],
  startDate: string,
  endDate: string,
): string[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, d]));
  return enumerateDates(startDate, endDate).filter((date) => {
    const day = byDate.get(date);
    if (!day) return true;
    if (day.dayType === "travel" && day.secondaryCity?.trim()) return false;
    return !day.primaryCity.trim() && !day.secondaryCity?.trim();
  });
}

export function buildTripChatContext(graph: TripEntityGraph, groupId: string): string {
  const { basics } = graph;
  const dayPlaces = dayPlacesForGroup(graph, groupId);
  const stays = staysForGroup(graph, groupId);
  const legs = legsForGroup(graph, groupId);
  const inferredStays = inferStaysFromDayPlaces(
    dayPlaces,
    basics.startDate,
    basics.endDate,
    basics.departureCity ?? "",
    basics.returnCity ?? "",
  );
  const paintedSpan = paintedDateSpan(dayPlaces);

  const calendarLines = [...dayPlaces]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (day) =>
        `${day.date}: ${dayLabel(day)}${day.dayType !== "trip" ? ` [${day.dayType}]` : ""}`,
    );

  const gapDays = findUnpaintedTripDays(dayPlaces, basics.startDate, basics.endDate);
  const sparseStays = inferredStays
    .filter((stay) => {
      const span = enumerateDates(stay.startDate, stay.endDate);
      return span.length === 1 && stay.location.trim();
    })
    .map((stay) => `${stay.location} (${stay.startDate} only — may need extending)`);

  const activities = graph.activities
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  const activityLines = activities.map((a) => {
    const time = a.startTime ? a.startTime.slice(0, 5) : "TBC";
    const place = a.locationName?.trim() ? ` @ ${shortCity(a.locationName)}` : "";
    return `${a.date} ${time} ${a.title}${place}`;
  });

  const stayLines = stays.map(
    (s) =>
      `${s.cityLabel}${s.name ? ` (${s.name})` : ""}: ${s.checkInDate} → ${s.checkOutDate}`,
  );

  const transportLines = [
    ...legs.outbound.map((l) => `outbound ${l.travelDate}: ${l.fromCity} → ${l.toCity}`),
    ...legs.intercity.map(
      (l) => `intercity ${l.travelDate}: ${l.intercityFromCity} → ${l.intercityToCity}`,
    ),
    ...legs.return.map((l) => `return ${l.travelDate}: ${l.fromCity} → ${l.toCity}`),
  ];

  const alignmentNote =
    paintedSpan.first && paintedSpan.last
      ? paintedSpan.first < basics.startDate || paintedSpan.last > basics.endDate
        ? `Painted content (${paintedSpan.first} → ${paintedSpan.last}) extends outside trip bounds — consider shiftTripDates and/or setTripDateRange.`
        : paintedSpan.first > basics.startDate || paintedSpan.last < basics.endDate
          ? `Painted content (${paintedSpan.first} → ${paintedSpan.last}) sits inside trip bounds (${basics.startDate} → ${basics.endDate}) — there may be empty days at the edges.`
          : `Painted content fills ${paintedSpan.first} → ${paintedSpan.last}.`
      : "No cities painted on the calendar yet.";

  const guidanceLines: string[] = [];
  if (gapDays.length > 0) {
    guidanceLines.push(
      `Priority: ${gapDays.length} unpainted day(s) inside trip bounds — extend stays or paintDayRange/setDayPlaces to fill ${gapDays.slice(0, 8).join(", ")}${gapDays.length > 8 ? "…" : ""}.`,
    );
  }
  if (sparseStays.length > 0) {
    guidanceLines.push(
      "Some cities appear on only one calendar day — likely need stay extension through the gap.",
    );
  }
  if (!transportLines.length && paintedSpan.first) {
    guidanceLines.push("No transport legs recorded — host may want outbound/intercity/return legs added.");
  }
  if (guidanceLines.length === 0 && paintedSpan.first) {
    guidanceLines.push("Calendar looks mostly complete — host may want activities, transport detail, or date tweaks.");
  }

  return [
    `Trip: ${basics.name}`,
    `Trip bounds (official window): ${basics.startDate} to ${basics.endDate}`,
    `Reference year for interpreting partial dates: ${basics.startDate.slice(0, 4)}`,
    `Timezone: ${basics.timezone}`,
    `Departure city: ${basics.departureCity || "(not set)"}`,
    `Return city: ${basics.returnCity || "(not set)"}`,
    `Group id for commands: ${groupId}`,
    alignmentNote,
    "",
    "Calendar (authoritative — stays, transport, and activities should follow this):",
    calendarLines.length ? calendarLines.join("\n") : "(no days painted yet)",
    "",
    gapDays.length
      ? `Unpainted days inside trip bounds: ${gapDays.join(", ")}`
      : "Unpainted days inside trip bounds: none",
    sparseStays.length
      ? `Single-day location anchors (likely need stay extension):\n${sparseStays.join("\n")}`
      : "",
    guidanceLines.length ? `Assistant guidance (use for "what next" / gap questions):\n${guidanceLines.join("\n")}` : "",
    "",
    "Accommodation stays:",
    stayLines.length ? stayLines.join("\n") : "(none)",
    "",
    "Transport legs:",
    transportLines.length ? transportLines.join("\n") : "(none)",
    "",
    `Activities (${activities.length} total):`,
    activityLines.length ? activityLines.join("\n") : "(none)",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Lean context for "add visit X on the 14th" style requests — calendar + existing activities only. */
export function buildFocusedActivityEditContext(
  graph: TripEntityGraph,
  groupId: string,
): string {
  const { basics } = graph;
  const dayPlaces = dayPlacesForGroup(graph, groupId);

  const calendarLines = [...dayPlaces]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (day) =>
        `${day.date}: ${dayLabel(day)}${day.dayType !== "trip" ? ` [${day.dayType}]` : ""}`,
    );

  const activities = graph.activities
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""),
    );
  const activityLines = activities.map((a) => {
    const time = a.startTime ? a.startTime.slice(0, 5) : "TBC";
    const place = a.locationName?.trim() ? ` @ ${shortCity(a.locationName)}` : "";
    return `${a.date} ${time} ${a.title}${place}`;
  });

  return [
    `Trip: ${basics.name}`,
    `Trip bounds: ${basics.startDate} to ${basics.endDate}`,
    `Reference year when host says "the 14th" without a year: ${basics.startDate.slice(0, 4)}`,
    `Group id for commands: ${groupId}`,
    "",
    "Calendar — where the group is each day (place each new activity on a sensible date):",
    calendarLines.length ? calendarLines.join("\n") : "(no days painted yet)",
    "",
    `Activities already on the trip (${activities.length}):`,
    activityLines.length ? activityLines.join("\n") : "(none)",
  ].join("\n");
}
