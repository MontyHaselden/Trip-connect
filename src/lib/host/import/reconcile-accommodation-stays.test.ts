import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isAccommodationCheckItemTitle,
  reconcileImportedAccommodationStays,
  resolveCheckoutActivityTime,
} from "@/lib/host/import/reconcile-accommodation-stays";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

function bangkokStay(checkOutDate: string): AccommodationStayDraft {
  return {
    id: "bkk",
    cityLabel: "Bangkok",
    stayType: "hotel",
    name: "Centre Point Plus Hotel Silom",
    url: null,
    address: null,
    phone: null,
    checkInDate: "2026-08-31",
    checkOutDate,
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
  };
}

describe("reconcileImportedAccommodationStays", () => {
  it("moves checkout to departure day when AI set checkout after evening flight", () => {
    const stays = [bangkokStay("2026-09-05")];
    const legs = [
      {
        travelDate: "2026-09-04",
        departureTime: "21:40",
        fromCity: "Bangkok",
        fromStation: null,
      },
    ];
    const out = reconcileImportedAccommodationStays(stays, legs);
    assert.equal(out[0]?.checkOutDate, "2026-09-04");
  });

  it("keeps checkout on departure day when already correct", () => {
    const stays = [bangkokStay("2026-09-04")];
    const legs = [
      {
        travelDate: "2026-09-04",
        departureTime: "21:40",
        fromCity: "Bangkok",
        fromStation: null,
      },
    ];
    const out = reconcileImportedAccommodationStays(stays, legs);
    assert.equal(out[0]?.checkOutDate, "2026-09-04");
  });
});

describe("resolveCheckoutActivityTime", () => {
  it("uses morning checkout before evening departure", () => {
    const time = resolveCheckoutActivityTime(
      { cityLabel: "Bangkok" },
      "2026-09-04",
      [{ travelDate: "2026-09-04", departureTime: "21:40", fromCity: "Bangkok", fromStation: null }],
    );
    assert.equal(time, "10:00:00");
  });

  it("uses earlier checkout before morning flight", () => {
    const time = resolveCheckoutActivityTime(
      { cityLabel: "Melbourne" },
      "2026-09-05",
      [{ travelDate: "2026-09-05", departureTime: "11:05", fromCity: "Melbourne", fromStation: null }],
    );
    assert.equal(time, "08:00:00");
  });
});

describe("isAccommodationCheckItemTitle", () => {
  it("detects check-in/out titles", () => {
    assert.equal(isAccommodationCheckItemTitle("Check out: Hotel"), true);
    assert.equal(isAccommodationCheckItemTitle("Check-in: Hotel"), true);
    assert.equal(isAccommodationCheckItemTitle("Breakfast"), false);
  });
});
