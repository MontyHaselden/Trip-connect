import type { TripCommand } from "./commands";
import {
  editGroupIdForLens,
  partyPersonalGroupIds,
  type CalendarLens,
} from "./person-lens";
import type { RosterSummary, TripEntityGraph } from "./types";

/** Duplicate group-scoped commands across every personal group in a party lens. */
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

    if ("groupId" in command && typeof command.groupId === "string") {
      const shouldFanOut =
        partyGroupIds.includes(command.groupId) || command.groupId === activeGroupId;
      if (shouldFanOut) {
        for (const groupId of partyGroupIds) {
          expanded.push({ ...command, groupId } as TripCommand);
        }
        continue;
      }
    }

    expanded.push(command);
  }

  return expanded;
}
