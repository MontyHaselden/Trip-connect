import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { looksLikeDaySchedule } from "./day-schedule-detect";
import { processMockChatMessage } from "./mock-chat";

const DAY_MESSAGE =
  "breakfast at 6 in the lobby, bring your bag we will be heading straight to the trainstation at 7 via a bus there. will make our way to the sky try arriving around 10. then will have lunch at 12 somewhere in the mall attached. at 1 we will catch the train back then bus to the hotel again. free time wandering around until we meet accorss the road for dinner at 6";

describe("looksLikeDaySchedule", () => {
  it("detects multi-activity day descriptions", () => {
    assert.equal(looksLikeDaySchedule(DAY_MESSAGE), true);
  });

  it("does not flag short dinner move prompts", () => {
    assert.equal(looksLikeDaySchedule("Move the Osaka dinner from 6pm to 7pm."), false);
  });
});

describe("processMockChatMessage dinner matcher", () => {
  it("does not treat full day schedules as dinner moves", () => {
    const result = processMockChatMessage({
      message: DAY_MESSAGE,
      itinerary: { days: [] },
      changeScope: { mode: "today", date: "2026-06-07" },
    });

    assert.equal(result.proposedChanges.some((c) => c.summary.includes("dinner")), false);
  });

  it("still handles explicit dinner move prompts", () => {
    const result = processMockChatMessage({
      message: "Move the Osaka dinner from 6pm to 7pm.",
      itinerary: { days: [] },
      changeScope: { mode: "today", date: "2026-06-07" },
    });

    assert.equal(result.proposedChanges[0]?.summary, "Move dinner to 7:00pm");
  });
});
