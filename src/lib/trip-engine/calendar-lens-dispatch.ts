import type { TripCommand } from "./commands";
import {
  editGroupIdForLens,
  partyPersonalGroupIds,
  personalGroupIdForParticipant,
  type CalendarLens,
} from "./person-lens";
import type { RosterSummary, TripEntityGraph } from "./types";

const PARTY_FANOUT_COMMAND_TYPES = new Set<TripCommand["type"]>([
  "paintDayRange",
  "setDayPlaces",
  "clearDayRange",
  "addStay",
  "updateStay",
  "removeStay",
  "setGroupInheritMode",
  "resetGroupFromMain",
]);

function ensureCommandsForPartyLens(
  commands: TripCommand[],
  lens: CalendarLens,
  graph: TripEntityGraph,
  roster: RosterSummary,
): TripCommand[] {
  if (lens.kind !== "party") return commands;

  const prepended: TripCommand[] = [];
  for (const participantId of lens.participantIds) {
    if (personalGroupIdForParticipant(graph, participantId)) continue;
    const person = roster.participants.find((p) => p.id === participantId);
    if (!person) continue;
    prepended.push({
      type: "ensurePersonalGroup",
      participantId,
      participantName: person.fullName?.trim() || "Participant",
      mode: "overlay",
    });
  }
  return prepended.length ? [...prepended, ...commands] : commands;
}

/** Duplicate group-scoped calendar commands across every personal group in a party lens. */
export function expandCommandsForCalendarLens(
  commands: TripCommand[],
  lens: CalendarLens,
  graph: TripEntityGraph,
  roster: RosterSummary,
): TripCommand[] {
  if (lens.kind !== "party") return commands;

  const partyGroupIds = partyPersonalGroupIds(graph, lens.participantIds);
  if (!partyGroupIds.length) return commands;

  const activeGroupId = editGroupIdForLens(graph, lens, roster);
  const expanded: TripCommand[] = [];

  for (const command of commands) {
    if (command.type === "ensurePersonalGroup") {
      if (lens.participantIds.includes(command.participantId)) {
        expanded.push(command);
      }
      continue;
    }

    if (
      PARTY_FANOUT_COMMAND_TYPES.has(command.type) &&
      "groupId" in command &&
      typeof command.groupId === "string"
    ) {
      const shouldFanOut =
        partyGroupIds.includes(command.groupId) || command.groupId === activeGroupId;
      if (shouldFanOut) {
        for (const groupId of partyGroupIds) {
          expanded.push({ ...command, groupId } as TripCommand);
        }
        if (command.type === "clearDayRange") {
          expanded.push({ ...command, groupId: graph.mainGroupId } as TripCommand);
        }
        continue;
      }
    }

    expanded.push(command);
  }

  return expanded;
}

/** Ensure personal groups exist, then fan out calendar commands for a party lens. */
export function prepareCommandsForCalendarLens(
  commands: TripCommand[],
  lens: CalendarLens,
  graph: TripEntityGraph,
  roster: RosterSummary,
): TripCommand[] {
  return expandCommandsForCalendarLens(
    ensureCommandsForPartyLens(commands, lens, graph, roster),
    lens,
    graph,
    roster,
  );
}
