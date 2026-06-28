import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dayHasMeaningfulLocationPaint,
  isPlaceholderCityLabel,
  stripPlaceholderDayPlaces,
} from "./placeholder-city";

describe("placeholder-city", () => {
  it("treats TBC as a placeholder label", () => {
    assert.equal(isPlaceholderCityLabel("TBC"), true);
    assert.equal(isPlaceholderCityLabel("Tbc"), true);
    assert.equal(isPlaceholderCityLabel("Tokyo"), false);
  });

  it("strips placeholder-only day paint", () => {
    const cleaned = stripPlaceholderDayPlaces([
      {
        date: "2026-12-22",
        primaryCity: "TBC",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-12-21",
        primaryCity: "Tokyo",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ]);

    assert.equal(cleaned.length, 1);
    assert.equal(cleaned[0]?.date, "2026-12-21");
    assert.equal(dayHasMeaningfulLocationPaint({ primaryCity: "TBC", secondaryCity: null }), false);
  });
});
