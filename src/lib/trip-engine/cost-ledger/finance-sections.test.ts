import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  absenceMessageForParticipant,
  financeSectionForLine,
  financeSectionList,
  groupLinesByFinanceSection,
  isFinanceCalendarSection,
  isVisibleTransportFinanceLine,
  isVisibleActivityFinanceLine,
  supportsManualExpenseLines,
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

  it("buckets orphan custom section lines into Other after tab delete", () => {
    const deletedSectionId = "section-other-2";
    const settings = {
      baseCurrency: "NZD",
      foreignCurrency: null,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateManual: false,
      financeCustomSections: [],
      financeViewGroups: [],
      financeSectionExclusions: {},
    };
    const orphanLine = line({
      category: "other",
      allocationRulePayload: { financeSection: deletedSectionId },
    });
    assert.equal(financeSectionForLine(orphanLine, undefined, settings), "other");
    const grouped = groupLinesByFinanceSection([orphanLine], undefined, settings);
    assert.equal(grouped.get("other")?.length, 1);
    assert.equal(grouped.get(deletedSectionId as "other"), undefined);
  });

  it("hides duplicate and product-billed per-leg transport rows from the transport tab", () => {
    const graph = {
      mainGroupId: "main",
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [
        {
          id: "leg-canonical",
          transportType: "plane",
          fromCity: "Tokyo",
          toCity: "Tottori",
          travelDate: "2026-12-06",
          originGroupId: "g-amanda",
        },
        {
          id: "leg-duplicate",
          transportType: "plane",
          fromCity: "Tokyo",
          toCity: "Tottori",
          travelDate: "2026-12-06",
          originGroupId: "g-kaleb",
        },
        {
          id: "leg-jr",
          transportType: "train",
          fromCity: "Tottori",
          toCity: "Hiroshima",
          travelDate: "2026-12-13",
          originGroupId: "g-amanda",
          transportProductId: "prod-jr",
        },
      ],
      transportProducts: [{ id: "prod-jr", kind: "train_pass", name: "JR Pass", participantIds: [] }],
    } as TripEntityGraph;

    const canonicalLine = line({
      id: "line-canonical",
      category: "transport",
      linkedTransportLegId: "leg-canonical",
    });
    const duplicateLine = line({
      id: "line-duplicate",
      category: "transport",
      linkedTransportLegId: "leg-duplicate",
    });
    const jrStaleLine = line({
      id: "line-jr-stale",
      category: "transport",
      linkedTransportLegId: "leg-jr",
    });
    const jrProductLine = line({
      id: "line-jr-product",
      category: "transport",
      linkedTransportProductId: "prod-jr",
    });

    assert.equal(isVisibleTransportFinanceLine(canonicalLine, graph), true);
    assert.equal(isVisibleTransportFinanceLine(duplicateLine, graph), false);
    assert.equal(isVisibleTransportFinanceLine(jrStaleLine, graph), false);
    assert.equal(isVisibleTransportFinanceLine(jrProductLine, graph), true);

    const grouped = groupLinesByFinanceSection(
      [canonicalLine, duplicateLine, jrStaleLine, jrProductLine],
      graph,
    );
    assert.deepEqual(
      grouped.get("transport")?.map((row) => row.id),
      ["line-canonical", "line-jr-product"],
    );
  });

  it("hides duplicate activity finance rows", () => {
    const graph = {
      activities: [
        { id: "act-canonical", title: "Tokyo tower", date: "2026-12-10", originGroupId: "main-group" },
        { id: "act-duplicate", title: "Tokyo tower", date: "2026-12-10", originGroupId: "main-group" },
      ],
    } as TripEntityGraph;

    const canonicalLine = line({
      id: "line-canonical",
      category: "activities",
      linkedActivityId: "act-canonical",
    });
    const duplicateLine = line({
      id: "line-duplicate",
      category: "activities",
      linkedActivityId: "act-duplicate",
    });

    assert.equal(isVisibleActivityFinanceLine(canonicalLine, graph), true);
    assert.equal(isVisibleActivityFinanceLine(duplicateLine, graph), false);

    const grouped = groupLinesByFinanceSection([canonicalLine, duplicateLine], graph);
    assert.deepEqual(grouped.get("activities")?.map((row) => row.id), ["line-canonical"]);
  });
});

describe("finance section tabs", () => {
  it("always includes permanent Other alongside calendar sections", () => {
    const sections = financeSectionList({
      baseCurrency: "NZD",
      foreignCurrency: null,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateManual: false,
      financeCustomSections: [],
      financeViewGroups: [],
      financeSectionExclusions: {},
    });
    assert.ok(sections.includes("other"));
    assert.ok(sections.includes("accommodation"));
  });

  it("allows manual expense lines on Other and custom sections only", () => {
    assert.equal(supportsManualExpenseLines("other"), true);
    assert.equal(supportsManualExpenseLines("accommodation"), false);
    assert.equal(supportsManualExpenseLines(crypto.randomUUID()), true);
    assert.equal(isFinanceCalendarSection("other"), false);
    assert.equal(isFinanceCalendarSection("transport"), true);
  });
});
