import { alignAccommodationStaysToLocationStays } from "@/lib/host/setup/accommodation-calendar";
import { summarizeTripDateRangeChange } from "@/lib/host/setup/set-trip-date-range";
import { fillSparseCalendarAnchors } from "@/lib/host/import/sanitize-imported-locations";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { dayPlacesForGroup, staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { findUnpaintedTripDays } from "./trip-chat-context";
import { summarizeSetupCalendarGaps } from "@/lib/host/import/post-import-reconcile";
import { parseDayMonthRangeFromMessage, parseMonthShiftFromMessage } from "./parse-trip-date-range";

/** Fast-path helpers kept for tests and optional offline use — trip chat is AI-first in production. */

export type TripChatProposal = {
  assistantReply: string;
  needsClarification: boolean;
  proposedCommands: TripCommand[];
  commandSummaries: string[];
  warnings: string[];
};

const FILL_GAPS_RE =
  /\b(fill\s+(in\s+)?(the\s+)?gaps?|complete\s+(the\s+)?calendar|extend\s+(the\s+)?stays?|paint\s+(the\s+)?missing\s+days?)\b/i;

const CLEAR_TRIP_RE =
  /\b(clear|remove|delete|wipe|reset|start\s+over|empty|undo\s+import)\b.*\b(everything|all|calendar|trip|itinerary|import|content|this|data)\b|\b(start\s+over|reset\s+(the\s+)?trip|clear\s+(the\s+)?(calendar|trip)|remove\s+all|delete\s+all|wipe\s+(the\s+)?calendar)\b/i;

const WHAT_NEXT_RE =
  /\b(what\s*next|what'?s\s*next|what\s*now|now\s*what|help\s*me\s*fix|anything\s*else)\b/i;

const RESCHEDULE_RE =
  /\b(change|move|shift|correct|actually|supposed|remove|trim|drop|wrong|apolog|meant)\b|\b\d{1,2}(?:st|nd|rd|th)?\s*(?:to|-)\s*(?:the\s*)?\d{1,2}(?:st|nd|rd|th)?\s*(?:of\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

function summarizeGapFill(
  beforeCount: number,
  afterCount: number,
  gapDays: string[],
): string {
  if (afterCount === 0) {
    return "I looked at your calendar — there are no empty days to fill inside the trip dates.";
  }
  return `I'll paint ${afterCount} missing day${afterCount === 1 ? "" : "s"} so each location stay runs continuously between arrival anchors.${gapDays.length ? ` (${gapDays.slice(0, 6).join(", ")}${gapDays.length > 6 ? "…" : ""})` : ""}`;
}

export function tryDeterministicTripChat(
  message: string,
  graph: TripEntityGraph,
  groupId: string,
): TripChatProposal | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (FILL_GAPS_RE.test(trimmed)) {
    return buildFillGapsProposal(graph, groupId);
  }

  if (CLEAR_TRIP_RE.test(trimmed)) {
    return buildClearTripProposal(graph, groupId);
  }

  if (WHAT_NEXT_RE.test(trimmed)) {
    return buildWhatNextProposal(graph, groupId);
  }

  const deltaMonths = parseMonthShiftFromMessage(trimmed);
  const range = parseDayMonthRangeFromMessage(trimmed, graph.basics.startDate);
  if (deltaMonths !== null && range) {
    return buildShiftAndRangeProposal(deltaMonths, range, graph);
  }
  if (deltaMonths !== null) {
    return buildShiftMonthsProposal(deltaMonths);
  }

  const reschedule = buildRescheduleProposal(trimmed, graph, groupId);
  if (reschedule) return reschedule;

  return null;
}

export function buildClearTripProposal(
  graph: TripEntityGraph,
  groupId: string,
): TripChatProposal {
  const { startDate, endDate } = graph.basics;
  return {
    assistantReply: [
      `I'll clear the calendar, stays, transport legs, and activities from **${startDate}** through **${endDate}** so you can start fresh.`,
      "Review the changes, then click **Apply changes**. You can import again or build the trip manually.",
    ].join(" "),
    needsClarification: false,
    proposedCommands: [
      {
        type: "clearDayRange",
        groupId,
        rangeStart: startDate,
        rangeEnd: endDate,
      },
    ],
    commandSummaries: ["Clear all trip content on the calendar"],
    warnings: [],
  };
}

export function buildWhatNextProposal(
  graph: TripEntityGraph,
  groupId: string,
): TripChatProposal {
  const gapDays = findUnpaintedTripDays(
    dayPlacesForGroup(graph, groupId),
    graph.basics.startDate,
    graph.basics.endDate,
  );
  const calendarGaps = summarizeSetupCalendarGaps(graph);

  if (gapDays.length) {
    const fill = buildFillGapsProposal(graph, groupId);
    const preview = gapDays.slice(0, 8).join(", ");
    return {
      ...fill,
      assistantReply: [
        `Here's what I'd do next:`,
        `**1. Fill ${gapDays.length} empty calendar day${gapDays.length === 1 ? "" : "s"}** — likely continuous stays (e.g. London blocks) that didn't paint on the first pass.${preview ? ` (${preview}${gapDays.length > 8 ? "…" : ""})` : ""}`,
        `**2. Review Transport** for any city changes without a leg.`,
        ``,
        fill.assistantReply,
      ].join("\n"),
    };
  }

  const transportNotes =
    calendarGaps.missingTransport.length > 0
      ? `I also see **${calendarGaps.missingTransport.length}** city change${calendarGaps.missingTransport.length === 1 ? "" : "s"} without transport logged yet — open **Transport** or tell me which leg to add.`
      : `Transport legs look mostly connected — skim **Transport** for any "unsure" or wrong-city entries (e.g. Bristol misread as Brisbane).`;

  return {
    assistantReply: [
      `Your calendar is continuous inside the trip dates — nice.`,
      transportNotes,
      `Tell me a specific date or city that looks wrong, or ask to add an activity / stay.`,
    ].join(" "),
    needsClarification: false,
    proposedCommands: [],
    commandSummaries: [],
    warnings: [],
  };
}

function monthShiftLabel(deltaMonths: number): string {
  const abs = Math.abs(deltaMonths);
  const direction = deltaMonths < 0 ? "earlier" : "later";
  return `Shift all trip dates ${direction} by ${abs} month${abs === 1 ? "" : "s"}`;
}

export function buildShiftMonthsProposal(deltaMonths: number): TripChatProposal {
  const abs = Math.abs(deltaMonths);
  const direction = deltaMonths < 0 ? "back" : "forward";
  const monthLabel = abs === 1 ? "one month" : `${abs} months`;

  return {
    assistantReply: `I'll shift everything on the calendar ${direction} by ${monthLabel} — day paint, stays, transport, and activities all move together. Review and click **Apply changes**.`,
    needsClarification: false,
    proposedCommands: [{ type: "shiftTripDates", deltaMonths }],
    commandSummaries: [monthShiftLabel(deltaMonths)],
    warnings: [],
  };
}

function buildShiftAndRangeProposal(
  deltaMonths: number,
  range: { startDate: string; endDate: string },
  graph: TripEntityGraph,
): TripChatProposal {
  const { startDate, endDate } = range;
  const { removedDaysBefore, removedDaysAfter } = summarizeTripDateRangeChange(
    { startDate: graph.basics.startDate, endDate: graph.basics.endDate },
    range,
  );

  const trimNotes: string[] = [];
  if (removedDaysBefore > 0) {
    trimNotes.push(`${removedDaysBefore} day${removedDaysBefore === 1 ? "" : "s"} before ${startDate}`);
  }
  if (removedDaysAfter > 0) {
    trimNotes.push(`${removedDaysAfter} day${removedDaysAfter === 1 ? "" : "s"} after ${endDate}`);
  }

  const abs = Math.abs(deltaMonths);
  const direction = deltaMonths < 0 ? "back" : "forward";
  const monthLabel = abs === 1 ? "one month" : `${abs} months`;

  return {
    assistantReply: [
      `I'll shift the whole trip ${direction} by ${monthLabel}, then trim the calendar to **${startDate}** through **${endDate}**.`,
      trimNotes.length
        ? `That drops ${trimNotes.join(" and ")} outside the new window.`
        : "Stays, transport, and activities follow the calendar automatically.",
      "Review and click **Apply changes**.",
    ].join(" "),
    needsClarification: false,
    proposedCommands: [
      { type: "shiftTripDates", deltaMonths },
      { type: "setTripDateRange", startDate, endDate },
    ],
    commandSummaries: [monthShiftLabel(deltaMonths), `Set trip window to ${startDate} → ${endDate}`],
    warnings: [],
  };
}

export function buildRescheduleProposal(
  message: string,
  graph: TripEntityGraph,
  groupId: string,
): TripChatProposal | null {
  const range = parseDayMonthRangeFromMessage(message, graph.basics.startDate);
  if (!range) {
    if (!RESCHEDULE_RE.test(message)) return null;
    const deltaMonths = parseMonthShiftFromMessage(message);
    if (deltaMonths !== null) {
      return buildShiftMonthsProposal(deltaMonths);
    }
    return {
      assistantReply:
        "Got it — you want to change the trip dates. Which **start and end dates** should I use? For example: \"16 to 26 July 2026\".",
      needsClarification: true,
      proposedCommands: [],
      commandSummaries: [],
      warnings: [],
    };
  }

  const { startDate, endDate } = range;
  const { removedDaysBefore, removedDaysAfter } = summarizeTripDateRangeChange(
    { startDate: graph.basics.startDate, endDate: graph.basics.endDate },
    range,
  );

  const trimNotes: string[] = [];
  if (removedDaysBefore > 0) {
    trimNotes.push(`${removedDaysBefore} day${removedDaysBefore === 1 ? "" : "s"} before ${startDate}`);
  }
  if (removedDaysAfter > 0) {
    trimNotes.push(`${removedDaysAfter} day${removedDaysAfter === 1 ? "" : "s"} after ${endDate}`);
  }

  return {
    assistantReply: [
      `I'll trim the trip to **${startDate}** through **${endDate}**.`,
      trimNotes.length
        ? `That drops ${trimNotes.join(" and ")} from the calendar — stays, transport, and activities outside the window follow automatically.`
        : "Stays, transport, and activities outside the window will follow the calendar automatically.",
      "Review and click **Apply changes**.",
    ].join(" "),
    needsClarification: false,
    proposedCommands: [{ type: "setTripDateRange", startDate, endDate }],
    commandSummaries: [`Set trip window to ${startDate} → ${endDate} (calendar-first)`],
    warnings: [],
  };
}

function buildStayAlignmentCommands(
  graph: TripEntityGraph,
  groupId: string,
  filledDays: ReturnType<typeof fillSparseCalendarAnchors>,
): TripCommand[] {
  const stays = staysForGroup(graph, groupId);
  const aligned = alignAccommodationStaysToLocationStays(
    stays,
    filledDays,
    graph.basics.startDate,
    graph.basics.endDate,
    graph.basics.departureCity ?? "",
    graph.basics.returnCity ?? "",
  );

  const commands: TripCommand[] = [];
  for (const stay of aligned) {
    if (!stay.id?.trim()) continue;
    const before = stays.find((entry) => entry.id === stay.id);
    if (!before) continue;
    if (
      before.checkInDate === stay.checkInDate &&
      before.checkOutDate === stay.checkOutDate
    ) {
      continue;
    }
    commands.push({
      type: "updateStay",
      groupId,
      stayId: stay.id,
      patch: {
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
      },
    });
  }
  return commands;
}

function remainingGapSummary(
  graph: TripEntityGraph,
  groupId: string,
  filledDays: ReturnType<typeof fillSparseCalendarAnchors>,
): string {
  const remaining = findUnpaintedTripDays(
    filledDays,
    graph.basics.startDate,
    graph.basics.endDate,
  );
  if (!remaining.length) {
    return "The calendar should now be continuous inside your trip dates.";
  }
  return `${remaining.length} day${remaining.length === 1 ? "" : "s"} still need a location (${remaining.slice(0, 5).join(", ")}${remaining.length > 5 ? "…" : ""}). Tell me which city those should be, or add arrival dates and ask again.`;
}

export function buildFillGapsProposal(
  graph: TripEntityGraph,
  groupId: string,
): TripChatProposal {
  const dayPlaces = dayPlacesForGroup(graph, groupId);
  const stays = staysForGroup(graph, groupId);
  const gapDays = findUnpaintedTripDays(
    dayPlaces,
    graph.basics.startDate,
    graph.basics.endDate,
  );

  const filled = fillSparseCalendarAnchors(
    dayPlaces,
    {
      startDate: graph.basics.startDate,
      endDate: graph.basics.endDate,
      departureCity: graph.basics.departureCity ?? "",
      returnCity: graph.basics.returnCity ?? "",
    },
    stays,
  );

  const changedDates = enumerateDates(graph.basics.startDate, graph.basics.endDate).filter(
    (date) => {
      const before = dayPlaces.find((d) => d.date === date);
      const after = filled.find((d) => d.date === date);
      if (!before || !after) return Boolean(after && !before);
      return (
        before.primaryCity !== after.primaryCity ||
        before.secondaryCity !== after.secondaryCity ||
        before.dayType !== after.dayType
      );
    },
  );

  if (!changedDates.length) {
    return {
      assistantReply: `${summarizeGapFill(0, 0, gapDays)} ${remainingGapSummary(graph, groupId, filled)}`,
      needsClarification: gapDays.length > 0,
      proposedCommands: [],
      commandSummaries: [],
      warnings: gapDays.length
        ? ["Some days are still empty — add arrival cities first, then ask again."]
        : [],
    };
  }

  const stayCommands = buildStayAlignmentCommands(graph, groupId, filled);
  const proposedCommands: TripCommand[] = [
    { type: "setDayPlaces", groupId, days: filled },
    ...stayCommands,
  ];
  const commandSummaries = [
    `Update calendar paint for ${changedDates.length} day${changedDates.length === 1 ? "" : "s"}`,
    ...(stayCommands.length
      ? [`Align ${stayCommands.length} accommodation stay${stayCommands.length === 1 ? "" : "s"} to the calendar`]
      : []),
  ];

  return {
    assistantReply: `${summarizeGapFill(changedDates.length, changedDates.length, gapDays)} Review the changes, then click Apply. ${remainingGapSummary(graph, groupId, filled)}`,
    needsClarification: false,
    proposedCommands,
    commandSummaries,
    warnings: [],
  };
}
