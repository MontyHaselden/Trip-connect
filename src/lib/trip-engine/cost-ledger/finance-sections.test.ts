import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  absenceMessageForParticipant,
  financeSectionForLine,
  groupLinesByFinanceSection,
} from "./finance-sections";
import { buildParticipantPresenceMap } from "./presence";
import type { CostLineItemDraft } from "./types";
import type { TripEntityGraph, RosterSummary } from "../types";

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

describe("financeSectionForLine", () => {
  it("maps linked entities to sections", () => {
    assert.equal(financeSectionForLine(line({ linkedStayId: "s1" })), "accommodation");
    assert.equal(financeSectionForLine(line({ linkedTransportLegId: "t1" })), "transport");
    assert.equal(financeSectionForLine(line({ linkedActivityId: "a1" })), "activities");
    assert.equal(financeSectionForLine(line({ category: "meals" })), null);
  });
});

describe("absenceMessageForParticipant", () => {
  it("uses homestay wording when participant is elsewhere", () => {
    const graph = {
      tripId: "trip-1",
      mainGroupId: "main",
      groups: [
        {
          id: "main",
          name: "Main",
          type: "main",
          isMain: true,
          sortOrder: 0,
          description: null,
        },
        {
          id: "amanda-g",
          name: "Amanda",
          type: "split_travel",
          isMain: false,
          sortOrder: 1,
          description: null,
          inheritMode: "independent",
          personalForParticipantId: "amanda",
        },
      ],
      dayPlacesByGroupId: {
        main: [
          {
            date: "2026-12-06",
            primaryCity: "Kagoshima",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
        "amanda-g": [
          {
            date: "2026-12-06",
            primaryCity: "Tottori",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
          },
        ],
      },
      accommodationStays: [
        {
          id: "stay-kagoshima",
          groupId: "main",
          name: "Homestay",
          cityLabel: "Kagoshima",
          stayType: "homestay",
          checkInDate: "2026-12-06",
          checkOutDate: "2026-12-12",
          originGroupId: "main",
        },
      ],
      activities: [],
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
      overlayOps: [],
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

    const roster: RosterSummary = {
      participants: [
        {
          id: "amanda",
          fullName: "Amanda Smith",
          role: "student",
          inCostSplit: true,
          groupIds: ["amanda-g"],
        },
        {
          id: "sam",
          fullName: "Sam Lee",
          role: "student",
          inCostSplit: true,
          groupIds: [],
        },
      ],
      groups: [{ id: "amanda-g", name: "Amanda" }],
      rooms: [],
    };

    const presence = buildParticipantPresenceMap(graph, roster);
    const homestayLine = line({ linkedStayId: "stay-kagoshima" });
    const msg = absenceMessageForParticipant(
      homestayLine,
      graph,
      roster,
      presence,
      "amanda",
    );
    assert.match(msg ?? "", /Amanda is not staying in a Kagoshima homestay/);
  });
});

describe("groupLinesByFinanceSection", () => {
  it("excludes meals and other categories", () => {
    const grouped = groupLinesByFinanceSection([
      line({ category: "meals" }),
      line({ linkedStayId: "s1", category: "accommodation" }),
    ]);
    assert.equal(grouped.get("accommodation")?.length, 1);
    assert.equal(grouped.get("transport")?.length, 0);
  });
});
