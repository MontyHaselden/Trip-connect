import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coalescePendingCommands } from "./coalesce-pending-commands";

describe("coalescePendingCommands", () => {
  it("keeps the last paintDayRange for the same group and range", () => {
    const out = coalescePendingCommands([
      {
        type: "paintDayRange",
        groupId: "g-kaleb",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Kagoshima",
      },
      {
        type: "paintDayRange",
        groupId: "g-kaleb",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0]?.type === "paintDayRange" ? out[0].location : "", "Tottori");
  });

  it("preserves separate party paints and collapses duplicate hides", () => {
    const out = coalescePendingCommands([
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
      {
        type: "paintDayRange",
        groupId: "g-kaleb",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
      {
        type: "hidePendingTransportNeed",
        groupId: "g-amanda",
        need: {
          kind: "intercity",
          date: "2026-12-06",
          fromCity: "Tokyo",
          toCity: "Kagoshima",
        },
      },
      {
        type: "unhidePendingTransportNeed",
        groupId: "g-amanda",
        need: {
          kind: "intercity",
          date: "2026-12-06",
          fromCity: "Tokyo",
          toCity: "Kagoshima",
        },
      },
    ]);

    assert.equal(out.length, 3);
    assert.equal(out[2]?.type, "unhidePendingTransportNeed");
  });

  it("merges updateTransportLeg patches for the same leg", () => {
    const out = coalescePendingCommands([
      {
        type: "updateTransportLeg",
        groupId: "g-amanda",
        bucket: "intercity",
        legId: "leg-1",
        patch: { fromCity: "Tokyo" },
      },
      {
        type: "updateTransportLeg",
        groupId: "g-amanda",
        bucket: "intercity",
        legId: "leg-1",
        patch: { transportType: "plane", toCity: "Tottori" },
      },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0]?.type, "updateTransportLeg");
    if (out[0]?.type === "updateTransportLeg") {
      assert.equal(out[0].patch.fromCity, "Tokyo");
      assert.equal(out[0].patch.transportType, "plane");
      assert.equal(out[0].patch.toCity, "Tottori");
    }
  });

  it("merges setDayPlaces for the same group", () => {
    const out = coalescePendingCommands([
      {
        type: "setDayPlaces",
        groupId: "g-amanda",
        days: [{ date: "2026-12-06", primaryCity: "Tokyo", dayType: "trip" }],
      },
      {
        type: "setDayPlaces",
        groupId: "g-amanda",
        days: [{ date: "2026-12-07", primaryCity: "Tottori", dayType: "trip" }],
      },
    ]);

    assert.equal(out.length, 1);
    if (out[0]?.type === "setDayPlaces") {
      assert.equal(out[0].days.length, 2);
    }
  });

  it("keeps the last addClassifiedTransportLegs for the same group and route", () => {
    const leg = {
      id: "leg-1",
      transportType: "train" as const,
      bookingStatus: "not_booked" as const,
      travelDate: "2026-12-13",
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      fromCity: "Tottori",
      toCity: "Hiroshima",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
      intercityFromCity: "Tottori",
      intercityToCity: "Hiroshima",
      originGroupId: "g-amanda",
      transportProductId: "jr-pass",
      billingMode: "product" as const,
    };
    const out = coalescePendingCommands([
      { type: "addClassifiedTransportLegs", groupId: "g-amanda", legs: [leg] },
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-amanda",
        legs: [{ ...leg, id: "leg-2", transportProductId: "jr-pass" }],
      },
    ]);

    assert.equal(out.length, 1);
    if (out[0]?.type === "addClassifiedTransportLegs") {
      assert.equal(out[0].legs[0]?.id, "leg-2");
    }
  });

  it("keeps the last addActivity for the same id or content", () => {
    const base = {
      date: "2026-12-10",
      endDate: null,
      startTime: "09:00",
      endTime: null,
      isTimeTbc: false,
      category: "other" as const,
      locationName: null,
      address: null,
      isLocationTbc: false,
      transportNote: null,
      leaveByTime: null,
      bringNote: null,
      description: null,
      audienceType: "everyone" as const,
      audienceId: null,
      originGroupId: "main-group",
      bookingStatus: "not_booked" as const,
    };
    const out = coalescePendingCommands([
      {
        type: "addActivity",
        groupId: "main-group",
        activity: { ...base, id: "act-1", title: "Tokyo tower" },
      },
      {
        type: "addActivity",
        groupId: "main-group",
        activity: { ...base, id: "act-2", title: "Tokyo tower" },
      },
      {
        type: "addActivity",
        groupId: "main-group",
        activity: { ...base, id: "act-1", title: "Tokyo tower", startTime: "10:00" },
      },
    ]);

    assert.equal(out.length, 1);
    if (out[0]?.type === "addActivity") {
      assert.equal(out[0].activity.id, "act-1");
      assert.equal(out[0].activity.startTime, "10:00");
    }
  });

  it("merges updateActivity patches into a pending addActivity", () => {
    const base = {
      date: "2026-12-10",
      endDate: null,
      startTime: "09:00",
      endTime: null,
      isTimeTbc: false,
      category: "other" as const,
      locationName: null,
      address: null,
      isLocationTbc: false,
      transportNote: null,
      leaveByTime: null,
      bringNote: null,
      description: null,
      audienceType: "everyone" as const,
      audienceId: null,
      originGroupId: "main-group",
      bookingStatus: "not_booked" as const,
    };
    const out = coalescePendingCommands([
      {
        type: "addActivity",
        groupId: "main-group",
        activity: { ...base, id: "act-1", title: "Shibuya" },
      },
      {
        type: "updateActivity",
        groupId: "main-group",
        activityId: "act-1",
        patch: { startTime: "14:00" },
      },
    ]);

    assert.equal(out.length, 1);
    if (out[0]?.type === "addActivity") {
      assert.equal(out[0].activity.startTime, "14:00");
    }
  });
});
