import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyCostLedgerProjection } from "./empty-projection";
import {
  activityFinanceAttentionById,
  activityFinanceDisplayStatus,
  financeActivityLinesForDay,
  financeSectionAllocationStatuses,
  lineFinanceAttentionReason,
  lineFinanceDisplayStatus,
  lineNeedsFinanceAllocation,
  stayFinanceAttentionById,
  stayFinanceDisplayStatus,
  stayFinanceDisplayStatusForStay,
  transportLegFinanceAttentionById,
  transportLegFinanceDisplayStatus,
} from "./finance-section-readiness";
import type { CostLineItemDraft } from "./types";
import type { TripEntityGraph } from "../types";

function minimalGraph(): TripEntityGraph {
  return {
    tripId: "trip-1",
    mainGroupId: "group-main",
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-01",
      endDate: "2026-12-31",
      timezone: "Pacific/Auckland",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
    groups: [{ id: "group-main", name: "Main", type: "whole_group", description: null, sortOrder: 0, isMain: true, inheritMode: null, personalForParticipantId: null }],
    dayPlacesByGroupId: { "group-main": [] },
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

function line(partial: Partial<CostLineItemDraft>): CostLineItemDraft {
  return {
    id: partial.id ?? "line-1",
    sortOrder: 0,
    category: "activities",
    description: "Sky Tree",
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_cost_participants",
    allocationRulePayload: { financeSection: "activities" },
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "trip_wide",
    costStatus: "unknown",
    linePaymentStatus: "unpaid",
    estimatedAmountCents: null,
    actualAmountCents: null,
    invoiceRecorded: false,
    receiptRecorded: false,
    supplierPaymentStatus: null,
    ...partial,
  };
}

describe("finance section readiness", () => {
  it("flags manual finance-only activity lines without a price", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [line({})];
    assert.equal(lineNeedsFinanceAllocation(ledger.lineItems[0]!, ledger), true);
    assert.match(
      lineFinanceAttentionReason(ledger.lineItems[0]!, ledger) ?? "",
      /total price/i,
    );
  });

  it("marks manual finance-only lines complete when priced and balanced", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        totalAmountCents: 197_600,
        description: "Visit USJ",
      }),
    ];
    ledger.lineAllocations = [
      {
        lineItemId: "line-1",
        balanced: true,
        pinnedParticipantIds: [],
        eligibleParticipantIds: ["p1", "p2"],
        allocations: { p1: 98_800, p2: 98_800 },
        allocatedTotalCents: 197_600,
      },
    ];
    assert.equal(lineNeedsFinanceAllocation(ledger.lineItems[0]!, ledger), false);
    assert.equal(lineFinanceAttentionReason(ledger.lineItems[0]!, ledger), null);
  });

  it("uses effective totals when per-person pins exist but stored total is zero", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        linkedActivityId: "act-usj",
        totalAmountCents: 0,
        description: "Visit USJ",
        allocationRulePayload: {},
      }),
    ];
    ledger.lineAllocations = [
      {
        lineItemId: "line-1",
        balanced: false,
        pinnedParticipantIds: ["p1", "p2"],
        eligibleParticipantIds: ["p1", "p2"],
        allocations: { p1: 104_00, p2: 104_00 },
        allocatedTotalCents: 208_00,
      },
    ];
    assert.equal(lineNeedsFinanceAllocation(ledger.lineItems[0]!, ledger), false);
  });

  it("marks rows complete while per-person edits are still saving", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        totalAmountCents: 0,
        description: "Visit USJ",
      }),
    ];
    ledger.lineAllocations = [
      {
        lineItemId: "line-1",
        balanced: false,
        pinnedParticipantIds: [],
        eligibleParticipantIds: ["p1", "p2"],
        allocations: {},
        allocatedTotalCents: 0,
      },
    ];
    const pending = { p1: 98_800, p2: 98_800 };
    assert.equal(lineFinanceAttentionReason(ledger.lineItems[0]!, ledger, pending), null);
    assert.equal(
      lineFinanceDisplayStatus(ledger.lineItems[0]!, ledger, pending),
      "complete",
    );
  });

  it("ignores placeholder New line rows", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [line({ description: "New line", totalAmountCents: 0 })];
    assert.equal(lineNeedsFinanceAllocation(ledger.lineItems[0]!, ledger), false);
  });

  it("surfaces section counts for nav", () => {
    const graph = minimalGraph();
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({ id: "a1", allocationRulePayload: { financeSection: "activities" } }),
      line({
        id: "a2",
        description: "Hotel",
        allocationRulePayload: { financeSection: "accommodation" },
      }),
    ];
    const statuses = financeSectionAllocationStatuses(ledger, graph);
    const activities = statuses.find((row) => row.section === "activities");
    assert.equal(activities?.unallocatedCount, 1);
    assert.equal(activities?.financeOnlyCount, 1);
  });

  it("lists manual activity finance lines for a day", () => {
    const graph = minimalGraph();
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({ id: "today", notes: "2026-12-17" }),
      line({ id: "other", notes: "2026-12-18", description: "Other" }),
    ];
    const matches = financeActivityLinesForDay(ledger, graph, "2026-12-17");
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.id, "today");
  });

  it("maps stay ids to finance lines that need attention", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        id: "stay-line",
        category: "accommodation",
        linkedStayId: "stay-1",
        allocationRulePayload: {},
      }),
      line({
        id: "done-line",
        category: "accommodation",
        linkedStayId: "stay-2",
        totalAmountCents: 5000,
        allocationRulePayload: {},
      }),
    ];
    ledger.lineAllocations = [
      {
        lineItemId: "done-line",
        balanced: true,
        pinnedParticipantIds: [],
        eligibleParticipantIds: ["p1"],
        allocations: { p1: 5000 },
        allocatedTotalCents: 5000,
      },
    ];
    const map = stayFinanceAttentionById(ledger);
    assert.equal(map.get("stay-1"), "stay-line");
    assert.equal(map.has("stay-2"), false);
  });

  it("maps transport legs including product package lines", () => {
    const graph = minimalGraph();
    graph.intercityLegs = [
      {
        id: "leg-a",
        groupId: "group-main",
        transportType: "train",
        fromCity: "Tokyo",
        toCity: "Kyoto",
        travelDate: "2026-12-10",
        transportProductId: "prod-jr",
      } as TripEntityGraph["intercityLegs"][number],
      {
        id: "leg-b",
        groupId: "group-main",
        transportType: "train",
        fromCity: "Kyoto",
        toCity: "Osaka",
        travelDate: "2026-12-12",
        transportProductId: "prod-jr",
      } as TripEntityGraph["intercityLegs"][number],
    ];
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        id: "product-line",
        category: "transport",
        linkedTransportProductId: "prod-jr",
        allocationRulePayload: {},
      }),
    ];
    const map = transportLegFinanceAttentionById(ledger, graph);
    assert.equal(map.get("leg-a"), "product-line");
    assert.equal(map.get("leg-b"), "product-line");
  });

  it("ignores stale per-leg finance rows when a leg is billed on a transport product", () => {
    const graph = minimalGraph();
    graph.intercityLegs = [
      {
        id: "leg-hiroshima",
        groupId: "group-main",
        transportType: "train",
        fromCity: "Tottori",
        toCity: "Hiroshima",
        travelDate: "2026-12-13",
        transportProductId: "prod-jr",
      } as TripEntityGraph["intercityLegs"][number],
    ];
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        id: "product-line",
        category: "transport",
        description: "JR Pass",
        linkedTransportProductId: "prod-jr",
        totalAmountCents: 120_000,
        allocationRulePayload: {},
      }),
      line({
        id: "stale-leg-line",
        category: "transport",
        description: "2026-12-13: Tottori → Hiroshima",
        linkedTransportLegId: "leg-hiroshima",
        allocationRulePayload: {},
      }),
    ];
    ledger.lineAllocations = [
      {
        lineItemId: "product-line",
        balanced: true,
        pinnedParticipantIds: ["p1", "p2"],
        eligibleParticipantIds: ["p1", "p2"],
        allocations: { p1: 60_000, p2: 60_000 },
        allocatedTotalCents: 120_000,
      },
      {
        lineItemId: "stale-leg-line",
        balanced: true,
        pinnedParticipantIds: [],
        eligibleParticipantIds: ["p1", "p2"],
        allocations: {},
        allocatedTotalCents: 0,
      },
    ];
    assert.equal(
      transportLegFinanceDisplayStatus(
        { id: "leg-hiroshima", transportProductId: "prod-jr" },
        ledger,
      ),
      "complete",
    );
  });

  it("maps activity ids to finance lines that need attention", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        id: "act-line",
        linkedActivityId: "act-1",
        allocationRulePayload: {},
      }),
    ];
    const map = activityFinanceAttentionById(ledger);
    assert.equal(map.get("act-1"), "act-line");
  });

  it("reports entity finance display status", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        id: "stay-open",
        category: "accommodation",
        linkedStayId: "stay-1",
        allocationRulePayload: {},
      }),
      line({
        id: "stay-done",
        category: "accommodation",
        linkedStayId: "stay-2",
        totalAmountCents: 8000,
        allocationRulePayload: {},
      }),
    ];
    ledger.lineAllocations = [
      {
        lineItemId: "stay-done",
        balanced: true,
        pinnedParticipantIds: [],
        eligibleParticipantIds: ["p1"],
        allocations: { p1: 8000 },
        allocatedTotalCents: 8000,
      },
    ];
    assert.equal(stayFinanceDisplayStatus("stay-1", ledger), "needs_attention");
    assert.equal(stayFinanceDisplayStatus("stay-2", ledger), "complete");
    assert.equal(stayFinanceDisplayStatus("stay-missing", ledger), "none");
  });

  it("shows accommodation finance attention before ledger sync when stay is named", () => {
    const graph = {
      mainGroupId: "main",
      accommodationStays: [
        {
          id: "stay-1",
          name: "Hotel Villa Fontaine",
          cityLabel: "Tokyo",
          checkInDate: "2026-12-05",
          checkOutDate: "2026-12-06",
          originGroupId: "main",
        },
      ],
    } as TripEntityGraph;
    assert.equal(
      stayFinanceDisplayStatusForStay(
        graph.accommodationStays[0]!,
        null,
        graph,
      ),
      "needs_attention",
    );
  });

  it("treats activity lines marked no_cost as finance-complete without a price", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        linkedActivityId: "act-park",
        totalAmountCents: 0,
        costStatus: "no_cost",
        allocationRulePayload: {},
      }),
    ];
    assert.equal(lineNeedsFinanceAllocation(ledger.lineItems[0]!, ledger), false);
    assert.equal(lineFinanceAttentionReason(ledger.lineItems[0]!, ledger), null);
    assert.equal(lineFinanceDisplayStatus(ledger.lineItems[0]!, ledger), "complete");
  });

  it("treats lines marked tbc as pending confirmation without a red attention badge", () => {
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        linkedActivityId: "act-museum",
        totalAmountCents: 0,
        costStatus: "tbc",
        allocationRulePayload: {},
      }),
    ];
    assert.equal(lineNeedsFinanceAllocation(ledger.lineItems[0]!, ledger), false);
    assert.equal(lineFinanceAttentionReason(ledger.lineItems[0]!, ledger), null);
    assert.equal(lineFinanceDisplayStatus(ledger.lineItems[0]!, ledger), "tbc");
    assert.equal(activityFinanceDisplayStatus("act-museum", ledger), "tbc");
  });

  it("counts tbc rows separately from unallocated finance rows", () => {
    const graph = minimalGraph();
    const ledger = emptyCostLedgerProjection();
    ledger.lineItems = [
      line({
        id: "tbc-transport",
        linkedTransportLegId: "leg-1",
        costStatus: "tbc",
        allocationRulePayload: { financeSection: "transport" },
      }),
      line({
        id: "needs-price",
        linkedTransportLegId: "leg-2",
        allocationRulePayload: { financeSection: "transport" },
      }),
    ];
    const transport = financeSectionAllocationStatuses(ledger, graph).find(
      (row) => row.section === "transport",
    );
    assert.equal(transport?.tbcCount, 1);
    assert.equal(transport?.unallocatedCount, 1);
  });
});
