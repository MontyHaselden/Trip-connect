import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSeedLineItems } from "./seed-from-graph";
import { financeSectionForLine, groupLinesByFinanceSection } from "./finance-sections";
import type { CostLineItemDraft } from "./types";
import type { TripEntityGraph } from "../types";

function line(partial: Partial<CostLineItemDraft>): CostLineItemDraft {
  return {
    id: "line-1",
    description: "Test",
    category: "accommodation",
    quantity: 1,
    totalAmountCents: 10000,
    currency: "NZD",
    allocationRuleType: "equal_present",
    allocationRulePayload: {},
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "presence",
    notes: null,
    sortOrder: 0,
    ...partial,
  };
}

function graphWithStays(
  stays: TripEntityGraph["accommodationStays"],
): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "main",
    groups: [],
    dayPlacesByGroupId: {},
    accommodationStays: stays,
    activities: [],
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    overlayOps: [],
    bookingsSummary: [],
    emergencySummary: {
      localEmergencyNumber: null,
      schoolEmergencyNumber: null,
      contactsCount: 0,
      phrasesCount: 0,
    },
    publishSummary: {
      publishedVersion: 0,
      viewerGalleryEnabled: false,
      viewerRoomDetailsEnabled: false,
    },
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-06",
      endDate: "2026-12-20",
      timezone: "Asia/Tokyo",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
  } as TripEntityGraph;
}

describe("buildSeedLineItems accommodation", () => {
  it("seeds named stays only, not location placeholders", () => {
    const graph = graphWithStays([
      {
        id: "stay-named",
        groupId: "main",
        name: "The Knot",
        cityLabel: "Hiroshima",
        stayType: "hotel",
        checkInDate: "2026-12-10",
        checkOutDate: "2026-12-12",
        originGroupId: "main",
      },
      {
        id: "stay-placeholder",
        groupId: "main",
        name: null,
        cityLabel: "Tokyo",
        stayType: "hotel",
        checkInDate: "2026-12-06",
        checkOutDate: "2026-12-08",
        originGroupId: "main",
      },
    ] as TripEntityGraph["accommodationStays"]);

    const seeds = buildSeedLineItems(graph);
    const staySeeds = seeds.filter((s) => s.category === "accommodation");
    assert.equal(staySeeds.length, 1);
    assert.equal(staySeeds[0]?.linkedStayId, "stay-named");
    assert.match(staySeeds[0]?.description ?? "", /The Knot/);
  });
});

describe("financeSectionForLine location placeholders", () => {
  it("excludes lines linked to unnamed stays when graph is provided", () => {
    const graph = graphWithStays([
      {
        id: "stay-placeholder",
        groupId: "main",
        name: null,
        cityLabel: "Tottori",
        stayType: "hotel",
        checkInDate: "2026-12-06",
        checkOutDate: "2026-12-08",
        originGroupId: "main",
      },
    ] as TripEntityGraph["accommodationStays"]);

    const placeholderLine = line({
      id: "line-tottori",
      linkedStayId: "stay-placeholder",
      description: "Tottori",
    });

    assert.equal(financeSectionForLine(placeholderLine, graph), null);
    assert.equal(
      groupLinesByFinanceSection([placeholderLine], graph).get("accommodation")?.length,
      0,
    );
  });
});
