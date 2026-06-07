import type { ItineraryTree } from "@/components/host/itinerary/types";
import type { ChangeScopeInput } from "@/lib/ai/change-scope-schema";
import {
  formatChangeScopePrompt,
  primaryScopeDate,
  type ChangeScope,
} from "@/lib/ai/change-scope";
import { looksLikeDaySchedule } from "@/lib/ai/day-schedule-detect";
import { parseItineraryText, type TripContext } from "@/lib/ai/itinerary-import";
import type { MockChatResult, ProposedChange } from "@/lib/ai/mock-chat";
import { processMockChatMessage } from "@/lib/ai/mock-chat";
import { normalizeStoredTime } from "@/lib/utils/ai-time";

function scopeLabel(changeScope: ChangeScopeInput): string {
  if (changeScope.mode === "whole_trip") return "Scope: whole trip.";
  if (changeScope.mode === "today") return `Scope: ${changeScope.date}.`;
  return `Scope: ${changeScope.dates?.join(", ")}.`;
}

function withScopeReply(changeScope: ChangeScopeInput, reply: string): string {
  return `${reply}\n\n${scopeLabel(changeScope)}`;
}

function cityLabelForDate(itinerary: ItineraryTree, date: string): string {
  const day = itinerary.days.find((d) => d.date === date);
  return day?.cityLabel ?? "Day";
}

function importResultToProposedChanges(params: {
  days: Array<{
    date: string;
    cityLabel: string;
    items: Array<{
      startTime: string;
      endTime?: string | null;
      title: string;
      category?: string | null;
      transportNote?: string | null;
      bringNote?: string | null;
      locationName?: string | null;
    }>;
  }>;
}): ProposedChange[] {
  const changes: ProposedChange[] = [];
  for (const day of params.days) {
    for (const item of day.items) {
      changes.push({
        type: "add_item",
        summary: `${item.startTime.slice(0, 5)} ${item.title}`,
        payload: {
          date: day.date,
          startTime: normalizeStoredTime(item.startTime),
          endTime: item.endTime ? normalizeStoredTime(item.endTime) : null,
          title: item.title,
          category: item.category ?? null,
          transportNote: item.transportNote ?? null,
          bringNote: item.bringNote ?? null,
          locationName: item.locationName ?? null,
        },
      });
    }
  }
  return changes;
}

export async function processChatMessage(params: {
  message: string;
  itinerary: ItineraryTree;
  changeScope: ChangeScopeInput;
  trip: TripContext;
}): Promise<MockChatResult> {
  if (!looksLikeDaySchedule(params.message)) {
    return processMockChatMessage(params);
  }

  const scopeDate = primaryScopeDate(params.changeScope);
  const scopePrompt = formatChangeScopePrompt(params.changeScope as ChangeScope);
  const scopedDayHint = scopeDate
    ? `All activities belong on ${scopeDate}. Use city "${cityLabelForDate(params.itinerary, scopeDate)}" for that day.`
    : "";

  try {
    const parsed = await parseItineraryText({
      text: params.message,
      trip: params.trip,
      instructions: [scopePrompt, scopedDayHint].filter(Boolean).join("\n"),
    });

    const days =
      scopeDate && params.changeScope.mode !== "whole_trip"
        ? [
            {
              date: scopeDate,
              cityLabel: cityLabelForDate(params.itinerary, scopeDate),
              items: parsed.days.flatMap((day) => day.items),
            },
          ]
        : parsed.days.map((day) => ({
            date: day.date,
            cityLabel: day.cityLabel,
            items: day.items,
          }));

    const proposedChanges = importResultToProposedChanges({ days });
    if (!proposedChanges.length) {
      return {
        assistantReply: withScopeReply(
          params.changeScope,
          "I parsed your day but couldn't find timed activities. Try listing times more clearly (e.g. breakfast at 6, lunch at 12).",
        ),
        needsClarification: true,
        proposedChanges: [],
        warnings: ["No activities extracted"],
      };
    }

    const dayLabel = scopeDate ?? days.map((d) => d.date).join(", ");
    return {
      assistantReply: withScopeReply(
        params.changeScope,
        `I'll add ${proposedChanges.length} activities for ${dayLabel}. Review the list, then click Apply.`,
      ),
      needsClarification: false,
      proposedChanges,
      warnings: [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not parse day schedule.";
    return {
      assistantReply: withScopeReply(
        params.changeScope,
        `I couldn't parse that schedule (${message}). Check your OpenAI key or try shorter bullet points with times.`,
      ),
      needsClarification: true,
      proposedChanges: [],
      warnings: [message],
    };
  }
}
