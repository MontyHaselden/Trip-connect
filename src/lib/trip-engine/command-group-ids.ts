import type { TripCommand } from "./commands";

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
