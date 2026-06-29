import type { TripCommand } from "./commands";
import type { TripEntityGraph } from "./types";

function groupIdFromCommand(command: TripCommand): string | undefined {
  if ("groupId" in command && typeof command.groupId === "string") return command.groupId;
  return undefined;
}

export function groupIdFromCommands(commands: TripCommand[]): string | undefined {
  for (const command of commands) {
    const groupId = groupIdFromCommand(command);
    if (groupId) return groupId;
  }
  return undefined;
}

export function allGroupIdsFromCommands(commands: TripCommand[]): string[] {
  const ids = new Set<string>();
  for (const command of commands) {
    const groupId = groupIdFromCommand(command);
    if (groupId) ids.add(groupId);
  }
  return [...ids];
}

/** Calendar edits always target a known group — unknown ids fall back to main. */
export function coerceUnknownGroupCommandsToMain(
  commands: TripCommand[],
  graph: TripEntityGraph,
): TripCommand[] {
  const knownGroupIds = new Set(graph.groups.map((group) => group.id));
  return commands.map((command) => {
    if (!("groupId" in command) || typeof command.groupId !== "string") {
      return command;
    }
    if (knownGroupIds.has(command.groupId)) return command;
    return { ...command, groupId: graph.mainGroupId } as TripCommand;
  });
}
