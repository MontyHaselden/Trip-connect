import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLEAR_TRIP_RE,
  detectScopedDeleteTarget,
  normalizeChatTypos,
} from "./scoped-delete-intent";

describe("normalizeChatTypos", () => {
  it("fixes common activity misspellings", () => {
    assert.equal(normalizeChatTypos("delete all activies"), "delete all activities");
  });
});

describe("detectScopedDeleteTarget", () => {
  it("detects activity-only deletes with typos", () => {
    assert.equal(detectScopedDeleteTarget("delete all activies"), "activities");
    assert.equal(detectScopedDeleteTarget("lets try that again. Delete all activities"), "activities");
  });

  it("still detects whole-trip clears", () => {
    assert.equal(detectScopedDeleteTarget("remove everything on the calendar"), "trip");
  });

  it("does not treat delete all activies as whole-trip when typo is normalized", () => {
    assert.equal(CLEAR_TRIP_RE.test(normalizeChatTypos("delete all activies")), false);
  });
});
