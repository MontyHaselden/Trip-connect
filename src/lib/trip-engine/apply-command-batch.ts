import { normalizeCommand, type TripCommand } from "./commands";
import { applyCommands } from "./apply-commands";
import type { CommandResult, TripEntityGraph } from "./types";

export function applyCommandBatch(
  graph: TripEntityGraph,
  commands: TripCommand[],
): CommandResult {
  const normalized = commands.map((c) => normalizeCommand(c as TripCommand & { type: string }));
  return applyCommands(graph, normalized);
}
