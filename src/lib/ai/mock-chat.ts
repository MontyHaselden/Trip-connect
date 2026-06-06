import type { ItineraryTree } from "@/components/host/itinerary/types";

export type ProposedChange = {
  type: "add_item" | "update_item" | "add_day" | "add_prep";
  summary: string;
  payload: Record<string, unknown>;
};

export type MockChatResult = {
  assistantReply: string;
  needsClarification: boolean;
  proposedChanges: ProposedChange[];
  warnings: string[];
};

export function processMockChatMessage(params: {
  message: string;
  itinerary: ItineraryTree;
}): MockChatResult {
  const msg = params.message.trim();
  const lower = msg.toLowerCase();

  if (/jack.*noah|noah.*jack/.test(lower) && /sumo|samurai/.test(lower)) {
    return {
      assistantReply:
        "I can do that. Tuesday currently has Osaka Museum from 10:00am to 12:00pm for everyone. Do you want Sumo to replace Osaka Museum for everyone, or should both be shown? Also, should Jack and Noah's Samurai activity happen at the same time as Sumo?",
      needsClarification: true,
      proposedChanges: [],
      warnings: ["Overlapping activities for Jack and Noah", "Group exception needed"],
    };
  }

  if (/pre-trip|pretrip|meeting/.test(lower) && /may|june|lunch|class/.test(lower)) {
    return {
      assistantReply:
        "I'll add a pre-trip meeting day. Proposed: Meeting Class B Lunch on the date you mentioned, with a calendar label of \"Meeting\".",
      needsClarification: false,
      proposedChanges: [
        {
          type: "add_day",
          summary: "Add pre-trip meeting day",
          payload: { cityLabel: "School", calendarLabel: "Meeting" },
        },
        {
          type: "add_item",
          summary: "Meeting Class B Lunch",
          payload: {
            title: "Meeting Class B Lunch",
            startTime: "12:30:00",
            category: "meeting",
          },
        },
      ],
      warnings: [],
    };
  }

  if (/move.*dinner|dinner.*\d|osaka dinner|doe dinner/.test(lower)) {
    return {
      assistantReply:
        "Proposed change: move the Osaka dinner from 6:00pm to 7:00pm for everyone on that day.",
      needsClarification: false,
      proposedChanges: [
        {
          type: "update_item",
          summary: "Move dinner to 7:00pm",
          payload: { titleMatch: "dinner", startTime: "19:00:00" },
        },
      ],
      warnings: [],
    };
  }

  if (/emergency phrase|phrases for japan/.test(lower)) {
    return {
      assistantReply:
        "I can add 20 emergency phrases for Japan. This will create a new phrase category and draft translations for host review before publish.",
      needsClarification: false,
      proposedChanges: [
        {
          type: "add_prep",
          summary: "Queue emergency phrase generation",
          payload: { count: 20, destination: "Japan" },
        },
      ],
      warnings: ["Phrase translations require destination language in trip settings"],
    };
  }

  if (/less busy|move shopping/.test(lower)) {
    return {
      assistantReply:
        "I can lighten that day by moving shopping to tomorrow. Which shopping activity should I move, and what time works tomorrow?",
      needsClarification: true,
      proposedChanges: [],
      warnings: ["Day may still be busy after move"],
    };
  }

  if (/create.*japan|japan trip/.test(lower)) {
    return {
      assistantReply:
        "I'll scaffold a Japan trip with Tokyo, Osaka, Hiroshima, and Kagoshima days. Review the proposed schedule on the right, then click Apply.",
      needsClarification: false,
      proposedChanges: [
        {
          type: "add_day",
          summary: "Add Tokyo arrival day",
          payload: { cityLabel: "Tokyo", calendarLabel: "Tokyo" },
        },
      ],
      warnings: [],
    };
  }

  return {
    assistantReply:
      "I understood your request. In this MVP mock, try prompts like: \"Add a pre-trip meeting on 22 May\", \"On Tuesday everyone goes to sumo but Jack and Noah go to samurai\", or \"Move the Osaka dinner to 7pm\".",
    needsClarification: false,
    proposedChanges: [],
    warnings: ["No automatic changes matched — refine your message"],
  };
}
