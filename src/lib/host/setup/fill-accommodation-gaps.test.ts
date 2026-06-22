import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_HALF_SHARE } from "@/lib/host/wizard/location-stays";

import { fillAccommodationInteriorGaps } from "./fill-accommodation-gaps";

describe("fillAccommodationInteriorGaps", () => {
  const kyotoStay = {
    id: "kyoto",
    cityLabel: "Kyoto",
    stayType: "hotel" as const,
    name: "VIA INN",
    url: null,
    address: null,
    phone: null,
    checkInDate: "2026-12-15",
    checkOutDate: "2026-12-17",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
  };

  it("fills a blank interior day between same-city edge halves", () => {
    const result = fillAccommodationInteriorGaps(
      [
        {
          date: "2026-12-15",
          primaryCity: "Hiroshima",
          secondaryCity: "Kyoto",
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-12-17",
          primaryCity: "Kyoto",
          secondaryCity: "Osaka",
          primaryShare: DEFAULT_HALF_SHARE,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      [kyotoStay],
    );

    const dec16 = result.find((d) => d.date === "2026-12-16");
    assert.equal(dec16?.primaryCity, "Kyoto");
    assert.equal(dec16?.primaryShare, 1);
  });
});
