import type { TripCommand } from "@/lib/trip-engine/commands";

export type TripChatProposal = {
  assistantReply: string;
  needsClarification: boolean;
  proposedCommands: TripCommand[];
  commandSummaries: string[];
  warnings: string[];
};
