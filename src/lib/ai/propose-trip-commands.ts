import { z } from "zod";

import { completeOpenAiJson, parseOpenAiJsonContent } from "@/lib/ai/openai-json";
import { applyCommandBatch } from "@/lib/trip-engine/apply-command-batch";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { coerceProposedCommands } from "@/lib/trip-engine/coerce-proposed-command";
import { dayPlacesForGroup } from "@/lib/trip-engine/selectors";
import {
  mergeSetDayPlacesDays,
  sanitizeDayPlaceDraft,
} from "@/lib/trip-engine/sanitize-day-place";
import { newId } from "@/lib/host/wizard/types";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { friendlyTripChatFailure } from "./trip-chat-fallback";
import type { TripChatProposal } from "./trip-chat-proposal";
import { buildTripChatSystemPrompt } from "./trip-chat-system-prompt";
import type { ActivityDraft } from "@/lib/host/wizard/types";
import { mergeClientActivitiesIntoGraph } from "@/lib/trip-engine/merge-graph-activities";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(4000),
});

const ProposalSchema = z.object({
  assistantReply: z.string().min(1),
  needsClarification: z.boolean(),
  proposedCommands: z.array(z.record(z.string(), z.unknown())).default([]),
  activities: z.array(z.record(z.string(), z.unknown())).optional(),
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
): { commands: TripCommand[]; warnings: string[] } {
  const { commands, warnings } = coerceProposedCommands(raw, groupId);
  return {
    commands: commands.map((command) =>
      ensureEntityIds(injectGroupId(command, groupId)),
    ),
    warnings,
  };
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
      .filter((day) => Boolean(day?.date))
      .map((day) =>
        sanitizeDayPlaceDraft({
          ...day,
          date: day.date,
          primaryCity: day.primaryCity ?? "",
        }),
      );
    return {
      ...command,
      groupId: cmdGroup,
      days: mergeSetDayPlacesDays(existing, incoming),
    };
  });
}

export async function proposeTripCommands(params: {
  messages: Array<{ role: "user" | "assistant"; text: string }>;
  graph: TripEntityGraph;
  groupId: string;
  clientActivities?: ActivityDraft[] | null;
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
  clientActivities?: ActivityDraft[] | null;
}): Promise<TripChatProposal> {
  const graph = mergeClientActivitiesIntoGraph(params.graph, params.clientActivities);
  const parsedMessages = z.array(MessageSchema).safeParse(params.messages);
  if (!parsedMessages.success || !parsedMessages.data.length) {
    return friendlyTripChatFailure(new Error("Message required."));
  }

  const system = buildTripChatSystemPrompt(params.groupId, graph);

  const content = await completeOpenAiJson({
    system,
    messages: parsedMessages.data.map((message) => ({
      role: message.role,
      content: message.text,
    })),
    temperature: 0.4,
  });

  const parsed = ProposalSchema.safeParse(parseOpenAiJsonContent(content));
  if (!parsed.success) {
    return friendlyTripChatFailure(new Error("AI returned an invalid trip command proposal."));
  }

  const data = parsed.data;
  const rawEntries = [
    ...data.proposedCommands,
    ...(data.activities ?? []).map((activity) => ({ type: "addActivity", activity })),
  ];
  const normalized = normalizeProposedCommands(rawEntries, params.groupId);
  const proposedCommands = repairTripCommands(normalized.commands, graph, params.groupId);

  if (!proposedCommands.length) {
    return {
      assistantReply: data.assistantReply,
      needsClarification: data.needsClarification,
      proposedCommands: [],
      commandSummaries: data.commandSummaries,
      warnings: [...data.warnings, ...normalized.warnings],
    };
  }

  const dryRun = applyCommandBatch(graph, proposedCommands);
  const validationWarnings = [
    ...data.warnings,
    ...normalized.warnings,
    ...dryRun.warnings.map((w) => w.message),
    ...dryRun.conflicts.map((c) => c.message),
  ];

  return {
    assistantReply: data.assistantReply,
    needsClarification: data.needsClarification && proposedCommands.length === 0,
    proposedCommands,
    commandSummaries:
      data.commandSummaries.length > 0
        ? data.commandSummaries
        : proposedCommands.map((c) => c.type),
    warnings: validationWarnings,
  };
}
