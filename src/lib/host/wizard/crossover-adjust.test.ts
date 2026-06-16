import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyCrossoverDrag, slideDividerTowardHoverDate } from "./crossover-adjust";
import type { DayPlaceDraft } from "./types";

const trip = {
  startDate: "2026-06-02",
  endDate: "2026-06-22",
  departureCity: "Christchurch Airport, New Zealand",
  returnCity: "Christchurch Airport, New Zealand",
};

function day(date: string, patch: Partial<DayPlaceDraft>): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    ...patch,
  };
}

describe("applyCrossoverDrag between consecutive stays", () => {
  it("slides stay end forward onto the next city day", () => {
    const days = [
      day("2026-06-09", { primaryCity: "Kyoto, Japan" }),
      day("2026-06-10", { primaryCity: "Kyoto, Japan", primaryShare: 0.5 }),
      day("2026-06-11", { primaryCity: "Osaka, Japan" }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-10", 0.9, trip);
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;

    assert.equal(jun10.primaryCity, "Kyoto, Japan");
    assert.equal(jun10.primaryShare, 1);
    assert.equal(jun10.secondaryCity, null);
    assert.equal(jun11.primaryCity, "Kyoto, Japan");
    assert.equal(jun11.secondaryCity, "Osaka, Japan");
    assert.equal(jun11.primaryShare, 0.5);
  });

  it("slides crossover backward onto a full previous city day", () => {
    const days = [
      day("2026-06-10", { primaryCity: "Kyoto, Japan" }),
      day("2026-06-11", {
        primaryCity: "Kyoto, Japan",
        secondaryCity: "Osaka, Japan",
        primaryShare: 0.5,
        dayType: "travel",
      }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-11", 0.1, trip);
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;

    assert.equal(jun10.primaryCity, "Kyoto, Japan");
    assert.equal(jun10.secondaryCity, "Osaka, Japan");
    assert.equal(jun10.primaryShare, 0.5);
    assert.equal(jun11.primaryCity, "Osaka, Japan");
    assert.equal(jun11.secondaryCity, null);
    assert.equal(jun11.primaryShare, 1);
  });

  it("slides crossover forward when the next day is already the destination city", () => {
    const days = [
      day("2026-06-10", { primaryCity: "Tokyo, Japan" }),
      day("2026-06-11", {
        primaryCity: "Tokyo, Japan",
        secondaryCity: "Osaka, Japan",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-06-12", { primaryCity: "Osaka, Japan" }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-11", 0.9, trip);
    const jun11 = next.find((d) => d.date === "2026-06-11")!;
    const jun12 = next.find((d) => d.date === "2026-06-12")!;

    assert.equal(jun11.primaryCity, "Tokyo, Japan");
    assert.equal(jun11.secondaryCity, null);
    assert.equal(jun11.primaryShare, 1);
    assert.equal(jun12.primaryCity, "Tokyo, Japan");
    assert.equal(jun12.secondaryCity, "Osaka, Japan");
    assert.equal(jun12.primaryShare, 0.5);
  });

  it("slides stay end forward onto an open day missing from dayPlaces", () => {
    const days = [
      day("2026-06-10", { primaryCity: "Bangkok, Thailand", primaryShare: 0.5 }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-10", 0.9, trip);
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;

    assert.equal(jun10.primaryCity, "Bangkok, Thailand");
    assert.equal(jun10.primaryShare, 1);
    assert.equal(jun11.primaryCity, "Bangkok, Thailand");
    assert.equal(jun11.primaryShare, 0.5);
  });

  it("slides crossover backward onto an open previous day", () => {
    const days = [
      day("2026-06-11", {
        primaryCity: "Patong, Thailand",
        secondaryCity: "Bangkok, Thailand",
        primaryShare: 0.4,
        dayType: "travel",
      }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-11", 0.1, trip);
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;

    assert.equal(jun10.primaryCity, "Patong, Thailand");
    assert.equal(jun10.secondaryCity, "Bangkok, Thailand");
    assert.equal(jun10.primaryShare, 0.5);
    assert.equal(jun11.primaryCity, "Bangkok, Thailand");
    assert.equal(jun11.secondaryCity, null);
    assert.equal(jun11.primaryShare, 1);
  });

  it("retracts a stay end slid onto the next day", () => {
    const days = [
      day("2026-06-10", { primaryCity: "Bangkok, Thailand", primaryShare: 1 }),
      day("2026-06-11", { primaryCity: "Bangkok, Thailand", primaryShare: 0.5 }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-10", 0.1, trip);
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;

    assert.equal(jun10.primaryCity, "Bangkok, Thailand");
    assert.equal(jun10.primaryShare, 0.5);
    assert.equal(jun11.primaryCity, "");
    assert.equal(jun11.primaryShare, 1);
  });

  it("restores a crossover after it was slid onto the previous day", () => {
    const days = [
      day("2026-06-10", {
        primaryCity: "Patong, Thailand",
        secondaryCity: "Bangkok, Thailand",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-06-11", { primaryCity: "Bangkok, Thailand", primaryShare: 1 }),
    ];

    const next = applyCrossoverDrag(days, "2026-06-11", 0.1, trip);
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;

    assert.equal(jun10.primaryCity, "Patong, Thailand");
    assert.equal(jun10.primaryShare, 1);
    assert.equal(jun11.primaryCity, "Patong, Thailand");
    assert.equal(jun11.secondaryCity, "Bangkok, Thailand");
    assert.equal(jun11.primaryShare, 0.5);
  });

  it("slides a divider toward a hovered day in one update", () => {
    const days = [
      day("2026-06-10", { primaryCity: "Bangkok, Thailand", primaryShare: 0.5 }),
    ];

    const { days: next, dragDate } = slideDividerTowardHoverDate(
      days,
      "2026-06-10",
      "2026-06-12",
      trip,
    );
    const jun10 = next.find((d) => d.date === "2026-06-10")!;
    const jun11 = next.find((d) => d.date === "2026-06-11")!;
    const jun12 = next.find((d) => d.date === "2026-06-12")!;

    assert.equal(jun10.primaryCity, "Bangkok, Thailand");
    assert.equal(jun10.primaryShare, 1);
    assert.equal(jun11.primaryCity, "Bangkok, Thailand");
    assert.equal(jun11.primaryShare, 1);
    assert.equal(jun12.primaryCity, "Bangkok, Thailand");
    assert.equal(jun12.primaryShare, 0.5);
    assert.equal(dragDate, "2026-06-12");
  });
});
