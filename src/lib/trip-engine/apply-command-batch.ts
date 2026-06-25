import { normalizeCommand, type TripCommand } from "./commands";
import { coerceProposedCommands } from "./coerce-proposed-command";
import { applyCommands } from "./apply-commands";
import type { CommandResult, TripEntityGraph } from "./types";

export function applyCommandBatch(
  graph: TripEntityGraph,
  commands: TripCommand[],
): CommandResult {
  const { commands: coerced, warnings: coerceWarnings } = coerceProposedCommands(
    commands as Array<Record<string, unknown>>,
    graph.mainGroupId,
  );
  const normalized = coerced.map((c) => normalizeCommand(c as TripCommand & { type: string }));
  const result = applyCommands(graph, normalized);
  return {
    ...result,
    warnings: [
      ...coerceWarnings.map((message) => ({
        id: "invalid-command",
        message,
        section: "general" as const,
      })),
      ...result.warnings,
    ],
  };
}
