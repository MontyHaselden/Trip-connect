import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { looksLikeDaySchedule } from "./day-schedule-detect";

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
