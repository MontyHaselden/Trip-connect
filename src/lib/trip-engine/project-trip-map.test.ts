import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TripEntityGraph } from "./types";
import { projectTripMap } from "./project-trip-map";

function baseGraph(overrides?: Partial<TripEntityGraph>): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "main",
    basics: {
      name: "Test",
      schoolName: "School",
      startDate: "2026-12-01",
      endDate: "2026-12-20",
      destinationCountries: [],
      destinationLanguages: [],
      timezone: "Pacific/Auckland",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
    },
    dayPlacesByGroupId: { main: [] },
    groups: [{ id: "main", name: "Main", isMain: true, personalForParticipantId: null }],
    overlayOps: [],
    accommodationStays: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    activities: [],
    reminders: [],
    meetings: [],
    bookingsSummary: [],
    emergencySummary: {
      localEmergencyNumber: null,
      schoolEmergencyPhone: null,
      contactsCount: 0,
      phrasesCount: 0,
    },
    publishSummary: {
      publishedVersion: 0,
      viewerGalleryEnabled: false,
      viewerRoomDetailsEnabled: false,
    },
    ...overrides,
  } as TripEntityGraph;
}

describe("projectTripMap", () => {
  it("emits accommodation marker when lat/lng exist", () => {
    const graph = baseGraph({
      accommodationStays: [
        {
          id: "stay-1",
          cityLabel: "Kyoto",
          stayType: "hotel",
          name: "VIA INN",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-15",
          checkOutDate: "2026-12-17",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
          latitude: 34.9858,
          longitude: 135.7588,
        },
      ],
    });
    const result = projectTripMap(graph, { groupId: "main" });
    assert.equal(result.markers.length, 1);
    assert.equal(result.markers[0]?.entityType, "accommodation");
    assert.equal(result.markers[0]?.lat, 34.9858);
  });

  it("lists accommodation without coords in missing", () => {
    const graph = baseGraph({
      accommodationStays: [
        {
          id: "stay-1",
          cityLabel: "Tokyo",
          stayType: "hotel",
          name: "Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-19",
          checkOutDate: "2026-12-22",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
    });
    const result = projectTripMap(graph, { groupId: "main" });
    assert.equal(result.markers.length, 0);
    assert.ok(result.missingCoordinates.some((m) => m.entityId === "stay-1"));
  });

  it("draws intercity route when both cities have hotel anchors", () => {
    const graph = baseGraph({
      accommodationStays: [
        {
          id: "osaka",
          cityLabel: "Osaka",
          stayType: "hotel",
          name: "Osaka Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-17",
          checkOutDate: "2026-12-18",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
          latitude: 34.6937,
          longitude: 135.5023,
        },
        {
          id: "kyoto",
          cityLabel: "Kyoto",
          stayType: "hotel",
          name: "Kyoto Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-15",
          checkOutDate: "2026-12-17",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
          latitude: 35.0116,
          longitude: 135.7681,
        },
      ],
      intercityLegs: [
        {
          id: "leg-1",
          transportType: "train",
          bookingStatus: "booked",
          travelDate: "2026-12-17",
          arrivalDate: null,
          departureTime: null,
          arrivalTime: null,
          fromCity: "Kyoto",
          toCity: "Osaka",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Kyoto",
          intercityToCity: "Osaka",
        },
      ],
    });
    const result = projectTripMap(graph, { groupId: "main" });
    assert.equal(result.routeLines.length, 1);
    assert.equal(result.routeLines[0]?.endpointSource, "accommodation_anchor");
  });

  it("puts leg in missing when one anchor is missing", () => {
    const graph = baseGraph({
      accommodationStays: [
        {
          id: "kyoto",
          cityLabel: "Kyoto",
          stayType: "hotel",
          name: "Kyoto Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-15",
          checkOutDate: "2026-12-17",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
          latitude: 35.0116,
          longitude: 135.7681,
        },
      ],
      intercityLegs: [
        {
          id: "leg-1",
          transportType: "train",
          bookingStatus: "booked",
          travelDate: "2026-12-17",
          arrivalDate: null,
          departureTime: null,
          arrivalTime: null,
          fromCity: "Kyoto",
          toCity: "Osaka",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Kyoto",
          intercityToCity: "Osaka",
        },
      ],
    });
    const result = projectTripMap(graph, { groupId: "main" });
    assert.equal(result.routeLines.length, 0);
    assert.ok(result.missingCoordinates.some((m) => m.entityId === "leg-1"));
  });

  it("filters by category", () => {
    const graph = baseGraph({
      accommodationStays: [
        {
          id: "stay-1",
          cityLabel: "Kyoto",
          stayType: "hotel",
          name: "Hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-12-15",
          checkOutDate: "2026-12-17",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
          latitude: 35.0,
          longitude: 135.0,
        },
      ],
      activities: [
        {
          id: "act-1",
          title: "Temple visit",
          date: "2026-12-16",
          endDate: null,
          startTime: null,
          endTime: null,
          isTimeTbc: false,
          category: "sightseeing",
          locationName: "Kiyomizu",
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
      ],
    });
    const transportOnly = projectTripMap(graph, {
      groupId: "main",
      categories: new Set(["transport"]),
    });
    assert.equal(transportOnly.markers.length, 0);
  });
});
