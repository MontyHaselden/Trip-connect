import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  selectionNeedsSetup,
  stayDatesForExpandedSelection,
  stayDatesForSelection,
  stayForHalfSelection,
  stayRelevantToSelection,
  staySelectionSpan,
} from "./day-selection-setup";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

const stay: AccommodationStayDraft = {
  id: "s1",
  cityLabel: "Patong",
  stayType: "hotel",
  name: "Royal Paradise",
  url: null,
  address: null,
  phone: null,
  checkInDate: "2026-08-22",
  checkOutDate: "2026-09-02",
  notes: null,
  isHomestayGroup: false,
  multipleInCity: false,
  originGroupId: "g1",
};

function day(date: string, partial?: Partial<DayPlaceDraft>): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "normal",
    ...partial,
  };
}

describe("stayDatesForSelection", () => {
  it("maps a right-half click to check-in/out without expanding the calendar range", () => {
    assert.deepEqual(
      stayDatesForSelection({
        rangeStart: "2026-06-20",
        rangeEnd: "2026-06-20",
        startHalf: "right",
        endHalf: "right",
      }),
      { checkIn: "2026-06-20", checkOut: "2026-06-21" },
    );
  });

  it("maps a left-half click to the prior night", () => {
    assert.deepEqual(
      stayDatesForSelection({
        rangeStart: "2026-06-20",
        rangeEnd: "2026-06-20",
        startHalf: "left",
        endHalf: "left",
      }),
      { checkIn: "2026-06-19", checkOut: "2026-06-20" },
    );
  });
});

describe("stayForHalfSelection", () => {
  const checkoutStay: AccommodationStayDraft = {
    ...stay,
    id: "osaka",
    name: "RIHGA Royal Hotel",
    checkInDate: "2026-06-12",
    checkOutDate: "2026-06-20",
  };

  it("links checkout morning to the left half only", () => {
    assert.equal(
      stayForHalfSelection([checkoutStay], "2026-06-20", "left")?.name,
      "RIHGA Royal Hotel",
    );
    assert.equal(stayForHalfSelection([checkoutStay], "2026-06-20", "right"), null);
  });
});

describe("stayDatesForExpandedSelection", () => {
  it("maps a right-half night pair to one check-in/out", () => {
    assert.deepEqual(
      stayDatesForExpandedSelection({
        rangeStart: "2026-07-04",
        rangeEnd: "2026-07-05",
        startHalf: "right",
        endHalf: "left",
      }),
      { checkIn: "2026-07-04", checkOut: "2026-07-05" },
    );
  });
});

describe("stayRelevantToSelection", () => {
  it("excludes a stay that only ends inside a later selection", () => {
    assert.equal(stayRelevantToSelection(stay, "2026-08-31", "2026-09-04"), false);
  });

  it("includes checkout-morning when the selection is only that day", () => {
    assert.equal(stayRelevantToSelection(stay, "2026-09-02", "2026-09-02"), true);
  });

  it("includes a stay that begins within the selection", () => {
    const bangkok = { ...stay, id: "s2", checkInDate: "2026-09-01", checkOutDate: "2026-09-05" };
    assert.equal(stayRelevantToSelection(bangkok, "2026-08-31", "2026-09-04"), true);
  });

  it("clips displayed nights to the selected span", () => {
    const longStay = { ...stay, checkOutDate: "2026-09-10" };
    assert.deepEqual(staySelectionSpan(longStay, "2026-08-31", "2026-09-04"), {
      from: "2026-08-31",
      to: "2026-09-04",
    });
  });
});

describe("selectionNeedsSetup", () => {
  it("requires setup for an empty half-day selection", () => {
    const days = [
      day("2026-09-01", {
        primaryCity: "Patong",
        primaryShare: 0.5,
      }),
    ];
    const result = selectionNeedsSetup("2026-09-01", "2026-09-01", "right", days, [stay]);
    assert.equal(result.needsAccommodation, true);
    assert.equal(result.needsLocation, true);
  });

  it("requires setup when a multi-day range includes uncovered days", () => {
    const days = [
      day("2026-09-01", { primaryCity: "Patong", primaryShare: 0.5 }),
      day("2026-09-02"),
      day("2026-09-03"),
      day("2026-09-04"),
    ];
    const result = selectionNeedsSetup(
      "2026-09-01",
      "2026-09-04",
      "full",
      days,
      [stay],
    );
    assert.equal(result.needsAccommodation, true);
    assert.equal(result.needsLocation, true);
  });

  it("does not require setup when every day in range is fully covered", () => {
    const days = [
      day("2026-08-31", { primaryCity: "Patong" }),
      day("2026-09-01", { primaryCity: "Patong" }),
    ];
    const result = selectionNeedsSetup(
      "2026-08-31",
      "2026-09-01",
      "full",
      days,
      [stay],
    );
    assert.equal(result.needsAccommodation, false);
    assert.equal(result.needsLocation, false);
  });
});
