import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  homestayFamilyStays,
  homestayPeriodStays,
  isHomestayFamilyStay,
  isHomestayPeriodStay,
  nonHomestayStays,
} from "./homestay-helpers";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

function stay(overrides: Partial<AccommodationStayDraft> = {}): AccommodationStayDraft {
  return {
    id: "s1",
    cityLabel: "Kyoto",
    stayType: "hotel",
    name: "Hotel",
    url: null,
    address: null,
    phone: null,
    checkInDate: "2026-07-01",
    checkOutDate: "2026-07-05",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
    ...overrides,
  };
}

describe("homestay-helpers", () => {
  it("classifies period vs family homestays", () => {
    const period = stay({ stayType: "homestay", isHomestayGroup: true, name: "Homestays" });
    const family = stay({ stayType: "homestay", isHomestayGroup: false, name: "Tanaka family" });
    assert.equal(isHomestayPeriodStay(period), true);
    assert.equal(isHomestayFamilyStay(family), true);
    assert.equal(isHomestayPeriodStay(family), false);
  });

  it("filters stay lists", () => {
    const stays = [
      stay({ id: "h1", stayType: "hotel" }),
      stay({ id: "p1", stayType: "homestay", isHomestayGroup: true }),
      stay({ id: "f1", stayType: "homestay", isHomestayGroup: false, name: "Family" }),
    ];
    assert.equal(nonHomestayStays(stays).length, 1);
    assert.equal(homestayPeriodStays(stays).length, 1);
    assert.equal(homestayFamilyStays(stays).length, 1);
  });
});
