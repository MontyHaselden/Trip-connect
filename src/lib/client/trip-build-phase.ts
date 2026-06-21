import type { ImportChatTurn } from "@/lib/client/run-import-chat";

/** Trip calendar has been built or materially updated — follow-ups use trip chat, not import prep. */
export function tripBuildPhaseComplete(messages: ImportChatTurn[]): boolean {
  return messages.some(
    (message) =>
      message.role === "assistant" &&
      (/Imported successfully/i.test(message.text) ||
        /second pass on the calendar/i.test(message.text) ||
        /Applied — check the calendar/i.test(message.text) ||
        /filled the empty calendar/i.test(message.text) ||
        Boolean(message.applied) ||
        Boolean(message.proposedCommands?.length)),
  );
}
