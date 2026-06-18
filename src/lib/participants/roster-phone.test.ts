import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  generatePlaceholderPhone,
  isPlaceholderPhone,
  PLACEHOLDER_PHONE_PREFIX,
} from "@/lib/participants/roster-phone";

describe("roster-phone", () => {
  it("detects placeholder phones", () => {
    assert.equal(isPlaceholderPhone(`${PLACEHOLDER_PHONE_PREFIX}0001`), true);
    assert.equal(isPlaceholderPhone(`${PLACEHOLDER_PHONE_PREFIX}abc123def456`), true);
    assert.equal(isPlaceholderPhone("+64211234567"), false);
  });

  it("generates unique placeholder phones", () => {
    const a = generatePlaceholderPhone();
    const b = generatePlaceholderPhone();
    assert.notEqual(a, b);
    assert.equal(isPlaceholderPhone(a), true);
  });
});
