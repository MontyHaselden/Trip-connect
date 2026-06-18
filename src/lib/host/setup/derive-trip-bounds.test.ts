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

  it("extends end date when location paint reaches beyond the last stay checkout", () => {
    const bounds = deriveTripBoundsFromContent({
      accommodationStays: [
        {
          id: "s1",
          cityLabel: "Bangkok",
          stayType: "hotel",
          name: "Centre Point Plus",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-07-06",
          checkOutDate: "2026-07-10",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
      dayPlaces: [
        {
          date: "2026-07-12",
          primaryCity: "Paris, France",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    });

    assert.deepEqual(bounds, { startDate: "2026-07-06", endDate: "2026-07-12" });
  });
});
