import type { TripChatProposal } from "./trip-chat-deterministic";

export function friendlyTripChatFailure(err: unknown): TripChatProposal {
  const detail = err instanceof Error ? err.message : "";
  if (detail.includes("OPENAI_API_KEY")) {
    return {
      assistantReply:
        "I can't reach the AI service right now — the OpenAI key isn't configured on this server. Your message was saved; try again once that's fixed.",
      needsClarification: true,
      proposedCommands: [],
      commandSummaries: [],
      warnings: [],
    };
  }

  return {
    assistantReply:
      "I hit a snag working that out. Say what you want in plain language — for example moving the whole trip earlier, setting new start/end dates, or filling empty days on the calendar — and I'll propose specific changes you can apply.",
    needsClarification: true,
    proposedCommands: [],
    commandSummaries: [],
    warnings: detail ? [detail] : [],
  };
}

export function friendlyImportChatFailure(err: unknown): {
  status: "needs_clarification";
  assistantReply: string;
  importInstructions: null;
} {
  const detail = err instanceof Error ? err.message : "";
  if (detail.includes("OPENAI_API_KEY")) {
    return {
      status: "needs_clarification",
      assistantReply:
        "I can't read documents right now — the AI service isn't configured. Paste your itinerary as plain text and include the month and year, and I'll help from there.",
      importInstructions: null,
    };
  }

  return {
    status: "needs_clarification",
    assistantReply:
      "I had trouble with that message. If you're still preparing an import, tell me the exact start and end dates — or press **Import trip** when you're ready. If the trip is already on the calendar, ask me to fill gaps, fix legs, or adjust dates.",
    importInstructions: null,
  };
}
