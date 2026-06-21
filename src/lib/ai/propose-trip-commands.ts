import { z } from "zod";

import { completeOpenAiJson, parseOpenAiJsonContent } from "@/lib/ai/openai-json";
import { applyCommandBatch } from "@/lib/trip-engine/apply-command-batch";
import { normalizeCommand, type TripCommand } from "@/lib/trip-engine/commands";
import { dayPlacesForGroup } from "@/lib/trip-engine/selectors";
import {
  mergeSetDayPlacesDays,
  sanitizeDayPlaceDraft,
} from "@/lib/trip-engine/sanitize-day-place";
import { newId } from "@/lib/host/wizard/types";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import type { TripChatProposal } from "./trip-chat-deterministic";
import { tryDeterministicTripChat } from "./trip-chat-deterministic";
import { friendlyTripChatFailure } from "./trip-chat-fallback";
import { buildTripChatContext } from "./trip-chat-context";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4000),
});

const ProposalSchema = z.object({
  assistantReply: z.string().min(1),
  needsClarification: z.boolean(),
  proposedCommands: z.array(z.record(z.string(), z.unknown())).default([]),
  commandSummaries: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

function injectGroupId(command: TripCommand, groupId: string): TripCommand {
  const raw = command as TripCommand & { groupId?: string };
  if ("groupId" in raw && !raw.groupId) {
    return { ...raw, groupId } as TripCommand;
  }
  return command;
}

function ensureEntityIds(command: TripCommand): TripCommand {
  switch (command.type) {
    case "addActivity":
      return {
        ...command,
        activity: {
          ...command.activity,
          id: command.activity.id?.trim() ? command.activity.id : newId(),
        },
      };
    case "addStay":
      return {
        ...command,
        stay: {
          ...command.stay,
          id: command.stay.id?.trim() ? command.stay.id : newId(),
        },
      };
    case "addTransportLeg":
      return {
        ...command,
        leg: {
          ...command.leg,
          id: command.leg.id?.trim() ? command.leg.id : newId(),
        },
      };
    case "addClassifiedTransportLegs":
      return {
        ...command,
        legs: command.legs.map((leg) => ({
          ...leg,
          id: leg.id?.trim() ? leg.id : newId(),
        })),
      };
    default:
      return command;
  }
}

function normalizeProposedCommands(
  raw: Array<Record<string, unknown>>,
  groupId: string,
): TripCommand[] {
  return raw.map((entry) => {
    const normalized = normalizeCommand(entry as { type: string } & Record<string, unknown>);
    return ensureEntityIds(injectGroupId(normalized, groupId));
  });
}

function repairTripCommands(
  commands: TripCommand[],
  graph: TripEntityGraph,
  groupId: string,
): TripCommand[] {
  return commands.map((command) => {
    if (command.type !== "setDayPlaces") return command;
    const cmdGroup = command.groupId || groupId;
    const existing = dayPlacesForGroup(graph, cmdGroup);
    const incoming = command.days
      .filter((day): day is Partial<DayPlaceDraft> & { date: string } => Boolean(day?.date))
      .map(sanitizeDayPlaceDraft);
    return {
      ...command,
      groupId: cmdGroup,
      days: mergeSetDayPlacesDays(existing, incoming),
    };
  });
}

const TRIP_COMMAND_HELP = `Allowed command types (return JSON objects in proposedCommands):
- setTripDateRange: { type, startDate, endDate } — set/trim the official trip window (ISO dates). Calendar rows outside the window are removed; everything else follows.
- shiftTripDates: { type, deltaDays?, deltaMonths? } — move ALL dated content together (calendar paint, stays, transport, activities). Use for relative changes like "back a month", "a week earlier", "shift everything".
- paintDayRange: { type, groupId, rangeStart, rangeEnd, location, startHalf?, endHalf? }
- setDayPlaces: { type, groupId, days: DayPlaceDraft[] } — bulk calendar update (full day list for the group)
- addActivity / updateActivity / removeActivity
- addStay / updateStay / removeStay
- addTransportLeg / addClassifiedTransportLegs / updateTransportLeg / removeTransportLeg
- updateBasics: { type, basics: { name?, startDate?, endDate?, departureCity?, returnCity? } }

DayPlaceDraft: { date, primaryCity, secondaryCity?, primaryShare?, dayType?, includeBuffer? }
- dayType must be one of: trip, travel, meeting, free, buffer, return (never invent other values like "stay").
ActivityDraft needs: id (generate uuid-like), title, date, startTime, category, bookingStatus, audienceType.

Date-change strategy (calendar is source of truth):
1. Host wants relative move ("back one month", "everything a week earlier") → shiftTripDates first.
2. Host wants a new trip window ("16 June to 26 July", "trim to the 16th–26th") → setTripDateRange.
3. Content is on the wrong month AND window should change → shiftTripDates then setTripDateRange (in that order).
4. Host corrects one city on one day → often shiftTripDates covers it if the whole trip is offset; otherwise paintDayRange or setDayPlaces.
5. "Fill gaps" / extend stays between arrival anchors → setDayPlaces with corrected full calendar, or paintDayRange for each gap.

Only ask a clarifying question when something is genuinely ambiguous (unknown city, conflicting instructions, missing year when trip has no dates).`;

const SYSTEM_PROMPT = `You are Trip OS — a conversational AI trip planning assistant for school group travel hosts.

You help hosts improve their trip by proposing structured commands. You never write to the database yourself. There are NO fixed phrases or templates — interpret whatever the host says, including typos, casual wording, and follow-up questions.

${TRIP_COMMAND_HELP}

Return ONLY valid JSON:
{
  "assistantReply": "conversational reply to the host — explain what you understood and what will change",
  "needsClarification": false,
  "proposedCommands": [],
  "commandSummaries": ["human-readable bullet per command"],
  "warnings": []
}

How to think:
- Read the ENTIRE conversation. Never ask the host to repeat dates, ranges, or relative shifts they already stated in an earlier message.
- Interpret natural language freely — any phrasing counts: "move back a month", "what should we do next", "so what next", "fill the holes", "London is empty", "fix the Palma leg", "Christchurch on July 15 should be June 15", etc.
- Use ISO dates (YYYY-MM-DD). Infer the year from trip context when the host omits it.
- When you can propose safe, reasonable commands, do so — set needsClarification false and populate proposedCommands.
- assistantReply should sound like a helpful colleague, not a form validator or a menu of keywords.
- commandSummaries should be short and host-friendly.
- Do not propose destructive commands unless the host clearly asked to remove something.
- Prefer shiftTripDates + setTripDateRange over many small edits when retiming a whole trip.

Post-import / guidance (critical):
- The calendar may already be populated from a document import. NEVER ask the host to re-upload, re-paste, or re-import the PDF or itinerary.
- When the host asks what to do next, what's missing, or how to proceed (in any wording), use the trip state: unpainted days, sparse single-day anchors, missing transport legs, alignment vs trip bounds. Give a clear prioritized answer AND propose commands when you can fix things (especially setDayPlaces / paintDayRange to fill unpainted days between known city stays).
- If unpainted days exist inside trip bounds, proactively offer to fill them — include concrete fill commands when the surrounding cities make the fill obvious.
- For missing intercity legs, propose addTransportLeg or addClassifiedTransportLegs when you can infer route and date from the calendar.`;

function buildChatMessages(
  context: string,
  messages: Array<{ role: "user" | "assistant"; text: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  return [
    {
      role: "user",
      content: `Here is the current trip state:\n\n${context}\n\nI'll tell you what I want changed.`,
    },
    {
      role: "assistant",
      content:
        "I've loaded the full calendar, stays, transport, and activities. Tell me what to change — dates, cities, gaps, activities — in your own words.",
    },
    ...messages.map((message) => ({
      role: message.role,
      content: message.text,
    })),
  ];
}

export async function proposeTripCommands(params: {
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  graph: TripEntityGraph;
  groupId: string;
}): Promise<TripChatProposal> {
  try {
    return await proposeTripCommandsInner(params);
  } catch (err) {
    return friendlyTripChatFailure(err);
  }
}

async function proposeTripCommandsInner(params: {
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  graph: TripEntityGraph;
  groupId: string;
}): Promise<TripChatProposal> {
  const parsedMessages = z.array(MessageSchema).safeParse(params.messages);
  if (!parsedMessages.success || !parsedMessages.data.length) {
    return friendlyTripChatFailure(new Error("Message required."));
  }

  const lastUser = [...parsedMessages.data].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const deterministic = tryDeterministicTripChat(
      lastUser.text,
      params.graph,
      params.groupId,
    );
    if (deterministic) return deterministic;
  }

  const context = buildTripChatContext(params.graph, params.groupId);
  const system = `${SYSTEM_PROMPT}\n\nAlways include groupId "${params.groupId}" on group-scoped commands.`;

  const content = await completeOpenAiJson({
    system,
    messages: buildChatMessages(context, parsedMessages.data),
    temperature: 0.35,
  });

  const parsed = ProposalSchema.safeParse(parseOpenAiJsonContent(content));
  if (!parsed.success) {
    return friendlyTripChatFailure(new Error("AI returned an invalid trip command proposal."));
  }

  const data = parsed.data;
  const proposedCommands = repairTripCommands(
    normalizeProposedCommands(data.proposedCommands, params.groupId),
    params.graph,
    params.groupId,
  );

  if (!proposedCommands.length) {
    return {
      assistantReply: data.assistantReply,
      needsClarification: data.needsClarification,
      proposedCommands: [],
      commandSummaries: data.commandSummaries,
      warnings: data.warnings,
    };
  }

  const dryRun = applyCommandBatch(params.graph, proposedCommands);
  const validationWarnings = [
    ...data.warnings,
    ...dryRun.warnings.map((w) => w.message),
    ...dryRun.conflicts.map((c) => c.message),
  ];

  if (dryRun.conflicts.some((c) => c.severity === "blocking")) {
    return {
      assistantReply: `${data.assistantReply}\n\nI drafted changes but they conflict with the current trip — can you clarify which part should win?`,
      needsClarification: true,
      proposedCommands: [],
      commandSummaries: [],
      warnings: validationWarnings,
    };
  }

  return {
    assistantReply: data.assistantReply,
    needsClarification: data.needsClarification,
    proposedCommands,
    commandSummaries:
      data.commandSummaries.length > 0
        ? data.commandSummaries
        : proposedCommands.map((c) => c.type),
    warnings: validationWarnings,
  };
}
