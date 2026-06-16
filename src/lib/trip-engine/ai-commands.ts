import type { TripCommand } from "./commands";
import { applyCommands } from "./apply-commands";
import type { CommandResult, TripEntityGraph } from "./types";

export type CommandBatch = {
  commands: TripCommand[];
  source?: "manual" | "ai" | "import";
};

/** Apply a batch of commands from AI or import — same path as manual UI. */
export function applyCommandBatch(
  graph: TripEntityGraph,
  batch: CommandBatch,
): CommandResult {
  return applyCommands(graph, batch.commands);
}
