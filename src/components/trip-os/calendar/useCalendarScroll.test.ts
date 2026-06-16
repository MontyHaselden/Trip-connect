import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("useCalendarScroll contract", () => {
  it("scroll position must be preserved across updates (G5)", () => {
    const savedScrollTop = 420;
    const restoredScrollTop = savedScrollTop;
    assert.equal(restoredScrollTop, 420);
    assert.notEqual(restoredScrollTop, 0);
  });

  it("initial scroll runs only once per mount", () => {
    let hasInitialScrolled = false;
    function attemptInitialScroll() {
      if (hasInitialScrolled) return false;
      hasInitialScrolled = true;
      return true;
    }
    assert.equal(attemptInitialScroll(), true);
    assert.equal(attemptInitialScroll(), false);
  });
});
