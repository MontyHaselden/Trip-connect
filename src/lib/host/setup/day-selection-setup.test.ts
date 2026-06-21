import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  accommodationCityForSelection,
  accommodationLocationConflictMessage,
  detectAccommodationLocationConflicts,
  halfForDateInSelection,
  locationLabelForSelectedHalf,
  selectionNeedsSetup,
  stayDatesForExpandedSelection,
  stayDatesForRangeApply,
  stayDatesForSelection,
  stayForHalfSelection,
  stayLinkedToHalfAwareSelection,
  stayOverlapsSelection,
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

  it("maps an inclusive multi-day selection to checkout on the last selected day", () => {
    assert.deepEqual(
      stayDatesForSelection({
        rangeStart: "2026-07-01",
        rangeEnd: "2026-07-04",
        startHalf: "full",
        endHalf: "full",
      }),
      { checkIn: "2026-07-01", checkOut: "2026-07-04" },
    );
  });

  it("maps half-day start with full-day end to checkout on the last selected day", () => {
    assert.deepEqual(
      stayDatesForSelection({
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-16",
        startHalf: "right",
        endHalf: "full",
      }),
      { checkIn: "2026-07-10", checkOut: "2026-07-16" },
    );
  });

  it("extends checkout to the morning after when the range ends on the second half", () => {
    assert.deepEqual(
      stayDatesForSelection({
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-16",
        startHalf: "full",
        endHalf: "right",
      }),
      { checkIn: "2026-07-10", checkOut: "2026-07-17" },
    );
  });

  it("maps half-day start with checkout-morning end (Kyoto-style range)", () => {
    assert.deepEqual(
      stayDatesForSelection({
        rangeStart: "2026-12-15",
        rangeEnd: "2026-12-19",
        startHalf: "right",
        endHalf: "left",
      }),
      { checkIn: "2026-12-15", checkOut: "2026-12-19" },
    );
  });

  it("clamps form checkout past the selection so Dec 20 is not included", () => {
    assert.deepEqual(
      stayDatesForSelection(
        {
          rangeStart: "2026-12-15",
          rangeEnd: "2026-12-19",
          startHalf: "right",
          endHalf: "left",
        },
        { checkIn: "2026-12-15", checkOut: "2026-12-20" },
      ),
      { checkIn: "2026-12-15", checkOut: "2026-12-19" },
    );
  });
});

describe("stayDatesForRangeApply", () => {
  it("spans the full multi-day half-aware selection (Aug 31 eve – Sep 4 am)", () => {
    assert.deepEqual(
      stayDatesForRangeApply({
        rangeStart: "2026-08-31",
        rangeEnd: "2026-09-04",
        startHalf: "right",
        endHalf: "left",
      }),
      { checkIn: "2026-08-31", checkOut: "2026-09-04" },
    );
    assert.deepEqual(
      stayDatesForSelection(
        {
          rangeStart: "2026-08-31",
          rangeEnd: "2026-09-04",
          startHalf: "right",
          endHalf: "left",
        },
        { checkIn: "2026-09-01", checkOut: "2026-09-04" },
      ),
      { checkIn: "2026-09-01", checkOut: "2026-09-04" },
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

  it("does not link a same-day check-in stay to the left half", () => {
    const eveningCheckIn: AccommodationStayDraft = {
      ...stay,
      id: "shinagawa",
      name: "Shinagawa Prince Hotel",
      checkInDate: "2026-12-19",
      checkOutDate: "2026-12-22",
    };
    assert.equal(stayForHalfSelection([eveningCheckIn], "2026-12-19", "left"), null);
    assert.equal(
      stayForHalfSelection([eveningCheckIn], "2026-12-19", "right")?.name,
      "Shinagawa Prince Hotel",
    );
  });

  it("does not include a next-half check-in when the range ends on the first half", () => {
    const eveningCheckIn: AccommodationStayDraft = {
      ...stay,
      id: "shinagawa",
      name: "Shinagawa Prince Hotel",
      checkInDate: "2026-12-19",
      checkOutDate: "2026-12-22",
    };
    const kyotoStay: AccommodationStayDraft = {
      ...stay,
      id: "kyoto",
      name: "Miyako Hotel Kyoto",
      checkInDate: "2026-12-15",
      checkOutDate: "2026-12-19",
    };
    const selection = {
      rangeStart: "2026-12-15",
      rangeEnd: "2026-12-19",
      startHalf: "right" as const,
      endHalf: "left" as const,
    };
    assert.equal(stayOverlapsSelection(eveningCheckIn, selection), false);
    assert.equal(stayLinkedToHalfAwareSelection([eveningCheckIn], selection), null);
    assert.equal(
      stayForHalfSelection([kyotoStay], "2026-12-19", "left")?.name,
      "Miyako Hotel Kyoto",
    );
    assert.equal(stayForHalfSelection([kyotoStay], "2026-12-19", "right"), null);
    assert.equal(stayForHalfSelection([kyotoStay], "2026-12-20", "full"), null);
  });
});

describe("half-aware multi-day selection after checkout", () => {
  const patongCheckout: AccommodationStayDraft = {
    ...stay,
    id: "patong",
    name: "The Royal Paradise Hotel & Spa",
    checkInDate: "2026-07-01",
    checkOutDate: "2026-07-05",
  };

  const postCheckoutRange = {
    rangeStart: "2026-07-05",
    rangeEnd: "2026-07-08",
    startHalf: "right" as const,
    endHalf: "full" as const,
  };

  const checkoutSplitDay = day("2026-07-05", {
    primaryCity: "Patong",
    primaryShare: 0.5,
  });

  it("does not link a checkout stay when only post-checkout slices are selected", () => {
    assert.equal(stayOverlapsSelection(patongCheckout, postCheckoutRange), false);
    assert.equal(stayLinkedToHalfAwareSelection([patongCheckout], postCheckoutRange), null);
  });

  it("maps each date in the range to the selected half", () => {
    assert.equal(halfForDateInSelection(postCheckoutRange, "2026-07-05"), "right");
    assert.equal(halfForDateInSelection(postCheckoutRange, "2026-07-06"), "full");
    assert.equal(halfForDateInSelection(postCheckoutRange, "2026-07-08"), "full");
  });

  it("finds no stay on any selected slice", () => {
    for (const iso of ["2026-07-05", "2026-07-06", "2026-07-07", "2026-07-08"]) {
      const half = halfForDateInSelection(postCheckoutRange, iso);
      assert.equal(
        stayForHalfSelection([patongCheckout], iso, half),
        null,
        `${iso} (${half})`,
      );
    }
  });

  it("does not treat checkout-morning location as part of a right-half start", () => {
    assert.equal(locationLabelForSelectedHalf(checkoutSplitDay, "right"), "");
    assert.equal(locationLabelForSelectedHalf(checkoutSplitDay, "left"), "Patong");
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

describe("detectAccommodationLocationConflicts", () => {
  it("lists coalesced ranges where painted location differs from the stay city", () => {
    const days = [
      day("2026-07-10", { primaryCity: "Bangkok", primaryShare: 0.5, secondaryCity: "Paris, France" }),
      day("2026-07-11", { primaryCity: "Paris, France" }),
      day("2026-07-12", { primaryCity: "Paris, France" }),
      day("2026-07-17", { primaryCity: "Paris, France", primaryShare: 0.5, secondaryCity: "Greater London, England" }),
      day("2026-07-18", { primaryCity: "Greater London, England" }),
      day("2026-07-21", { primaryCity: "Majorca, Spain" }),
    ];

    const conflicts = detectAccommodationLocationConflicts(
      {
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-21",
        startHalf: "right",
        endHalf: "full",
      },
      days,
      "Queenstown, Otago Region",
    );

    assert.deepEqual(conflicts, [
      { rangeStart: "2026-07-10", rangeEnd: "2026-07-12", existingLocation: "Paris, France", existingAccommodation: null },
      {
        rangeStart: "2026-07-17",
        rangeEnd: "2026-07-17",
        existingLocation: "Paris, France · Greater London, England",
        existingAccommodation: null,
      },
      { rangeStart: "2026-07-18", rangeEnd: "2026-07-18", existingLocation: "Greater London, England", existingAccommodation: null },
      { rangeStart: "2026-07-21", rangeEnd: "2026-07-21", existingLocation: "Majorca, Spain", existingAccommodation: null },
    ]);
  });

  it("includes existing accommodation names when replacing a stay in another city", () => {
    const days = [
      day("2026-07-10", { primaryCity: "Bangkok", primaryShare: 0.5, secondaryCity: "Queenstown, Otago Region" }),
      day("2026-07-11", { primaryCity: "Queenstown, Otago Region" }),
      day("2026-07-12", { primaryCity: "Queenstown, Otago Region" }),
    ];

    const conflicts = detectAccommodationLocationConflicts(
      {
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-12",
        startHalf: "right",
        endHalf: "full",
      },
      days,
      "Khet Ratchathewi, Krung Thep Maha Nakhon",
      [
        {
          id: "reevers",
          cityLabel: "Queenstown, Otago Region",
          stayType: "hotel",
          name: "Reavers Lodge",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-07-10",
          checkOutDate: "2026-07-27",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
    );

    assert.deepEqual(conflicts, [
      {
        rangeStart: "2026-07-10",
        rangeEnd: "2026-07-12",
        existingLocation: "Queenstown, Otago Region",
        existingAccommodation: "Reavers Lodge",
      },
    ]);
  });

  it("ignores days whose selected slice already matches the stay city", () => {
    const conflicts = detectAccommodationLocationConflicts(
      {
        rangeStart: "2026-07-11",
        rangeEnd: "2026-07-13",
        startHalf: "full",
        endHalf: "full",
      },
      [day("2026-07-11", { primaryCity: "Queenstown, Otago Region" })],
      "Queenstown, Otago Region",
    );
    assert.deepEqual(conflicts, []);
  });
});

describe("accommodationCityForSelection", () => {
  it("uses selected halves on travel-edge days, not the unselected primary city", () => {
    const city = accommodationCityForSelection(
      {
        rangeStart: "2026-12-15",
        rangeEnd: "2026-12-17",
        startHalf: "right",
        endHalf: "left",
      },
      [
        day("2026-12-15", {
          primaryCity: "Hiroshima",
          secondaryCity: "Kyoto",
          primaryShare: 0.5,
        }),
        day("2026-12-16", { primaryCity: "Kyoto" }),
        day("2026-12-17", {
          primaryCity: "Kyoto",
          secondaryCity: "Osaka",
          primaryShare: 0.5,
        }),
      ],
    );
    assert.equal(city, "Kyoto");
  });
});
