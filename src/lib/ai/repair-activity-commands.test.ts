import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { inferCityFromTitle, repairAddActivityCommand } from "./repair-activity-commands";

function day(date: string, city: string): DayPlaceDraft {
  return {
    date,
    primaryCity: city,
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function graphWithDays(days: DayPlaceDraft[]): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "group-main",
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-06",
      endDate: "2026-12-22",
      timezone: "Asia/Tokyo",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
    groups: [
      {
        id: "group-main",
        name: "Main",
        type: "whole_group",
        description: null,
        sortOrder: 0,
        isMain: true,
        inheritMode: null,
        personalForParticipantId: null,
      },
    ],
    dayPlacesByGroupId: { "group-main": days },
    accommodationStays: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: { localEmergencyNumber: null, schoolEmergencyPhone: null },
    publishSummary: { viewerGalleryEnabled: true, viewerRoomDetailsEnabled: true },
  };
}

describe("inferCityFromTitle", () => {
  it("knows Kyoto landmarks", () => {
    assert.equal(inferCityFromTitle("Golden Pavilion"), "Kyoto");
    assert.equal(inferCityFromTitle("Fushimi Inari"), "Kyoto");
  });

  it("knows Tokyo landmarks", () => {
    assert.equal(inferCityFromTitle("Tokyo Sky Tree"), "Tokyo");
    assert.equal(inferCityFromTitle("Disneyland entry fee"), "Tokyo");
  });
});

describe("repairAddActivityCommand", () => {
  it("moves Golden Pavilion off a Hiroshima day to Kyoto", () => {
    const graph = graphWithDays([
      day("2026-12-14", "Hiroshima, Japan"),
      day("2026-12-15", "Kyoto, Japan"),
      day("2026-12-16", "Kyoto, Japan"),
    ]);
    const { command, warnings } = repairAddActivityCommand(
      {
        type: "addActivity",
        groupId: "group-main",
        activity: {
          id: "a1",
          title: "Golden Pavilion",
          date: "2026-12-14",
          endDate: null,
          startTime: "10:00",
          endTime: null,
          isTimeTbc: false,
          category: "activity",
          locationName: "Hiroshima, Japan",
          address: null,
          isLocationTbc: false,
          transportNote: null,
          leaveByTime: null,
          bringNote: null,
          description: null,
          audienceType: "everyone",
          audienceId: null,
          bookingStatus: "not_booked",
        },
      },
      graph,
      "group-main",
    );
    assert.equal(command.activity.date, "2026-12-15");
    assert.equal(command.activity.locationName, "Kyoto, Japan");
    assert.ok(warnings.some((w) => w.includes("Moved")));
  });

  it("keeps Tokyo Sky Tree on a Tokyo day", () => {
    const graph = graphWithDays([day("2026-12-07", "Tokyo, Japan")]);
    const { command, warnings } = repairAddActivityCommand(
      {
        type: "addActivity",
        groupId: "group-main",
        activity: {
          id: "a1",
          title: "Tokyo Sky Tree",
          date: "2026-12-07",
          endDate: null,
          startTime: "10:00",
          endTime: null,
          isTimeTbc: false,
          category: "activity",
          locationName: null,
          address: null,
          isLocationTbc: true,
          transportNote: null,
          leaveByTime: null,
          bringNote: null,
          description: null,
          audienceType: "everyone",
          audienceId: null,
          bookingStatus: "not_booked",
        },
      },
      graph,
      "group-main",
    );
    assert.equal(command.activity.date, "2026-12-07");
    assert.equal(command.activity.locationName, "Tokyo, Japan");
    assert.equal(warnings.length, 0);
  });
});
