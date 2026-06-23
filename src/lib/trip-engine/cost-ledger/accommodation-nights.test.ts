import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countStayNights,
  nightsLabel,
  participantNightsAtStay,
  perNightCents,
  splitByNightUnits,
} from "./accommodation-nights";
import type { ResolvedParticipantPlan } from "../resolve-participant-graph";

function plan(days: Record<string, { primary: string; secondary?: string }>): ResolvedParticipantPlan {
  const daysByDate = new Map(
    Object.entries(days).map(([date, day]) => [
      date,
      {
        date,
        primaryCity: day.primary,
        secondaryCity: day.secondary ?? null,
        primaryShare: day.secondary ? 0.5 : 1,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ]),
  );
  return {
    participantId: "p1",
    mode: "main",
    daysByDate,
    stayIds: new Set(),
    legIds: new Set(),
    activityIds: new Set(),
  };
}

describe("countStayNights", () => {
  it("counts hotel nights between check-in and check-out", () => {
    assert.equal(countStayNights("2026-12-17", "2026-12-21"), 4);
  });
});

describe("perNightCents", () => {
  it("derives nightly rate from total and nights", () => {
    assert.equal(perNightCents(904800, 4), 226200);
  });
});

describe("nightsLabel", () => {
  it("uses singular for one night", () => {
    assert.equal(nightsLabel(1), "1 night");
    assert.equal(nightsLabel(4), "4 nights");
  });
});

describe("participantNightsAtStay", () => {
  it("counts only nights the participant is at the stay city", () => {
    const nights = participantNightsAtStay(
      plan({
        "2026-12-17": { primary: "Tokyo, Japan" },
        "2026-12-18": { primary: "Tokyo, Japan" },
        "2026-12-19": { primary: "Christchurch, New Zealand" },
        "2026-12-20": { primary: "Christchurch, New Zealand" },
      }),
      {
        cityLabel: "Tokyo",
        checkInDate: "2026-12-17",
        checkOutDate: "2026-12-21",
      },
    );
    assert.equal(nights, 2);
  });
});

describe("splitByNightUnits", () => {
  it("allocates proportionally by nights", () => {
    const split = splitByNightUnits(9000, { a: 1, b: 3 });
    assert.equal(split.a, 2250);
    assert.equal(split.b, 6750);
  });
});
