import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveTripBoundsFromContent } from "./derive-trip-bounds";

describe("deriveTripBoundsFromContent", () => {
  it("returns bounds from named stays and ignores unset sentinel", () => {
    const bounds = deriveTripBoundsFromContent({
      accommodationStays: [
        {
          id: "s1",
          cityLabel: "Patong",
          stayType: "hotel",
          name: "Royal Paradise Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-08-22",
          checkOutDate: "2026-09-01",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
      dayPlaces: [
        {
          date: "2000-01-01",
          primaryCity: "",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    });

    assert.deepEqual(bounds, { startDate: "2026-08-22", endDate: "2026-09-01" });
  });
});
