import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accommodationBandsForCalendarDay,
  accommodationLabelByDate,
  accommodationLabelForCalendarDay,
  accommodationMorningHalfLabel,
  arrivalAccommodationLabel,
  coalesceAdjacentNamedStays,
  departureAccommodationLabel,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { bangkokStay, patongStay } from "@/lib/host/setup/calendar-fixtures";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

function stay(overrides: Partial<AccommodationStayDraft> = {}): AccommodationStayDraft {
  return {
    id: "s1",
    cityLabel: "Patong",
    stayType: "hotel",
    name: "Royal Paradise Hotel",
    url: null,
    address: "Amphoe Kathu, Chang Wat Phuket 83150, Thailand",
    phone: null,
    checkInDate: "2026-08-22",
    checkOutDate: "2026-09-02",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
    originGroupId: "main",
    ...overrides,
  };
}

describe("coalesceAdjacentNamedStays", () => {
  it("merges same hotel when the next stay starts on checkout day", () => {
    const merged = coalesceAdjacentNamedStays([
      patongStay({ checkInDate: "2026-08-23", checkOutDate: "2026-08-28" }),
      patongStay({
        id: "patong-b",
        checkInDate: "2026-08-28",
        checkOutDate: "2026-09-01",
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.checkInDate, "2026-08-23");
    assert.equal(merged[0]?.checkOutDate, "2026-09-01");
  });

  it("merges overlapping stays for the same property", () => {
    const merged = coalesceAdjacentNamedStays([
      patongStay({ checkInDate: "2026-08-24", checkOutDate: "2026-09-01" }),
      patongStay({
        id: "patong-b",
        checkInDate: "2026-08-24",
        checkOutDate: "2026-08-25",
      }),
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.checkInDate, "2026-08-24");
    assert.equal(merged[0]?.checkOutDate, "2026-09-01");
  });
});

describe("crossover accommodation labels", () => {
  it("shows departing hotel on checkout morning without using next-day arrival", () => {
    const stays = [patongStay({ checkOutDate: "2026-08-31" }), bangkokStay()];
    assert.equal(
      departureAccommodationLabel("2026-08-31", "Patong", stays),
      "Royal Paradise Hotel",
    );
    assert.equal(arrivalAccommodationLabel("2026-08-31", "Bangkok", stays), null);
    assert.equal(
      arrivalAccommodationLabel("2026-09-01", "Bangkok", stays),
      "Centre Point Plus",
    );
  });

  it("scopes checkout hotel to the departure half on a return-home split day", () => {
    const stays = [bangkokStay({ checkOutDate: "2026-09-04" })];
    const acco = new Map([["2026-09-04", "Centre Point Plus"]]);
    const day = {
      primaryCity: "Bangkok",
      secondaryCity: "Christchurch, New Zealand",
      primaryShare: 0.5,
      dayType: "return" as const,
    };
    assert.equal(
      accommodationLabelForCalendarDay("2026-09-04", day, stays, acco),
      "Centre Point Plus",
    );
  });

  it("does not show Bangkok checkout on the post-trip home buffer day", () => {
    const stays = [bangkokStay({ checkOutDate: "2026-09-05" })];
    const acco = accommodationLabelByDate(stays);
    const day = {
      primaryCity: "Christchurch, New Zealand",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer" as const,
    };
    assert.equal(accommodationLabelForCalendarDay("2026-09-05", day, stays, acco), null);
  });

  it("matches accommodation band width to checkout-morning location half", () => {
    const osakaStay = patongStay({
      cityLabel: "Osaka",
      name: "RIHGA Royal Hotel",
      checkInDate: "2026-06-12",
      checkOutDate: "2026-06-24",
    });
    const acco = accommodationLabelByDate([osakaStay]);
    const checkoutDay = {
      primaryCity: "Osaka",
      secondaryCity: null,
      primaryShare: 0.5,
      dayType: "trip" as const,
    };
    const bands = accommodationBandsForCalendarDay(
      "2026-06-24",
      checkoutDay,
      [osakaStay],
      acco,
    );
    assert.equal(bands.left, "RIHGA Royal Hotel");
    assert.equal(bands.leftOnly, true);
    assert.equal(bands.right, null);
  });

  it("matches accommodation band width to check-in evening location half", () => {
    const osakaStay = patongStay({
      cityLabel: "Osaka",
      name: "RIHGA Royal Hotel",
      checkInDate: "2026-06-12",
      checkOutDate: "2026-06-24",
    });
    const acco = accommodationLabelByDate([osakaStay]);
    const checkInDay = {
      primaryCity: "",
      secondaryCity: "Osaka",
      primaryShare: 0.5,
      dayType: "trip" as const,
    };
    const bands = accommodationBandsForCalendarDay(
      "2026-06-12",
      checkInDay,
      [osakaStay],
      acco,
    );
    assert.equal(bands.right, "RIHGA Royal Hotel");
    assert.equal(bands.rightOnly, true);
    assert.equal(bands.left, null);
  });

  it("does not bleed hotel onto the day after checkout", () => {
    const osakaStay = patongStay({
      cityLabel: "Osaka",
      name: "RIHGA Royal Hotel",
      checkInDate: "2026-06-12",
      checkOutDate: "2026-06-24",
    });
    const acco = accommodationLabelByDate([osakaStay]);
    const emptyDay = {
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "trip" as const,
    };
    assert.equal(accommodationMorningHalfLabel("2026-06-25", [osakaStay]), null);
    assert.equal(
      accommodationBandsForCalendarDay("2026-06-25", emptyDay, [osakaStay], acco).left,
      null,
    );
    const checkoutMorning = accommodationBandsForCalendarDay(
      "2026-06-24",
      emptyDay,
      [osakaStay],
      acco,
    );
    assert.equal(checkoutMorning.left, "RIHGA Royal Hotel");
    assert.equal(checkoutMorning.right, null);
    assert.equal(checkoutMorning.leftOnly, true);
  });

  it("shows checkout on the last selected day when location is fully painted", () => {
    const stay = patongStay({
      checkInDate: "2026-07-01",
      checkOutDate: "2026-07-04",
    });
    const acco = accommodationLabelByDate([stay]);
    const checkoutDay = {
      primaryCity: "Patong",
      secondaryCity: null,
      primaryShare: 1,
      dayType: "trip" as const,
    };
    assert.equal(acco.get("2026-07-04"), undefined);
    const bands = accommodationBandsForCalendarDay(
      "2026-07-04",
      checkoutDay,
      [stay],
      acco,
    );
    assert.equal(bands.left, "Royal Paradise Hotel");
    assert.equal(bands.leftOnly, true);
    assert.equal(
      accommodationBandsForCalendarDay("2026-07-05", checkoutDay, [stay], acco).left,
      null,
    );
  });

  it("shows checkout and same-day check-in on opposite halves", () => {
    const osakaStay = {
      ...patongStay({
        cityLabel: "Osaka",
        name: "RIHGA Royal Hotel",
        checkInDate: "2026-06-12",
        checkOutDate: "2026-06-20",
      }),
    };
    const kyotoStay = {
      ...bangkokStay({
        id: "kyoto",
        cityLabel: "Kyoto",
        name: "Kyoto Inn",
        checkInDate: "2026-06-20",
        checkOutDate: "2026-06-21",
      }),
    };
    const day = {
      primaryCity: "Osaka",
      secondaryCity: "Kyoto",
      primaryShare: 0.5,
      dayType: "trip" as const,
    };
    const bands = accommodationBandsForCalendarDay(
      "2026-06-20",
      day,
      [osakaStay, kyotoStay],
      new Map(),
    );
    assert.equal(bands.left, "RIHGA Royal Hotel");
    assert.equal(bands.right, "Kyoto Inn");
  });
});

describe("stayCityLabel", () => {
  it("prefers user region name over Google address inference", () => {
    assert.equal(stayCityLabel(stay({ cityLabel: "Patong" })), "Patong");
  });

  it("falls back to address inference when region is TBC", () => {
    const label = stayCityLabel(stay({ cityLabel: "TBC" }));
    assert.ok(label.includes("Kathu") || label.includes("Phuket"));
  });
});
