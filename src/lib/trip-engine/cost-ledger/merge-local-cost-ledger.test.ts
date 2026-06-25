import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyCostLedgerProjection } from "./empty-projection";
import { localCostLedgerIsAhead, mergePreferLocalCostLedger } from "./merge-local-cost-ledger";
import { setupStateToGraph } from "../adapters";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { CostLineItemDraft } from "./types";

function baseTripState(): TripSetupState {
  return {
    basics: {
      name: "Trip",
      schoolName: "School",
      startDate: "2026-12-04",
      endDate: "2026-12-22",
      timezone: "UTC",
      departureCity: "",
      returnCity: "",
      defaultDepartureAirport: null,
      destinationCountries: [],
    },
    mainGroupId: "main-group",
    groups: [
      {
        id: "main-group",
        name: "Everyone",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: { "main-group": [] },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [
      {
        id: "act-1",
        title: "Skytree",
        date: "2026-12-10",
        endDate: null,
        startTime: "09:00",
        endTime: null,
        isTimeTbc: false,
        category: "other",
        locationName: null,
        address: null,
        isLocationTbc: false,
        transportNote: null,
        leaveByTime: null,
        bringNote: null,
        description: null,
        audienceType: "everyone",
        audienceId: null,
        originGroupId: "main-group",
        bookingStatus: "not_booked",
      },
    ],
    overlayOps: [],
  };
}

function emptyGraph() {
  return setupStateToGraph("trip-1", baseTripState());
}

function graphWithoutActivities() {
  return setupStateToGraph("trip-1", { ...baseTripState(), activities: [] });
}

function manualLine(id: string, description: string): CostLineItemDraft {
  return {
    id,
    sortOrder: 0,
    category: "other",
    description,
    notes: null,
    totalAmountCents: 0,
    currency: "NZD",
    quantity: null,
    allocationRuleType: "equal_cost_participants",
    allocationRulePayload: { financeSection: "transport" },
    linkedStayId: null,
    linkedTransportLegId: null,
    linkedActivityId: null,
    scope: "trip_wide",
    supplierPaymentStatus: null,
    costStatus: "unknown",
    linePaymentStatus: "unpaid",
    fundingStatus: "unfunded",
    supplierName: null,
    estimatedAmountCents: null,
    actualAmountCents: null,
    taxTreatment: "unknown",
    exportCategoryLabel: null,
    exportReference: null,
    bookingReference: null,
    invoiceRecorded: false,
    receiptRecorded: false,
  };
}

function linkedActivityLine(id: string, activityId: string, title: string): CostLineItemDraft {
  return {
    ...manualLine(id, title),
    category: "activities",
    linkedActivityId: activityId,
    notes: "2026-07-23",
  };
}

describe("localCostLedgerIsAhead", () => {
  it("detects optimistic manual lines missing from server", () => {
    const local = emptyCostLedgerProjection();
    local.lineItems = [manualLine("optimistic-1", "Travel insurance")];
    const server = emptyCostLedgerProjection();
    assert.equal(localCostLedgerIsAhead(local, server), true);
  });

  it("is false when server already has the manual line", () => {
    const line = manualLine("real-id", "Travel insurance");
    const local = emptyCostLedgerProjection();
    local.lineItems = [line];
    const server = emptyCostLedgerProjection();
    server.lineItems = [line];
    assert.equal(localCostLedgerIsAhead(local, server), false);
  });

  it("detects linked activity rows missing from a stale server snapshot", () => {
    const local = emptyCostLedgerProjection();
    local.lineItems = [linkedActivityLine("server-line-1", "act-1", "Skytree")];
    const server = emptyCostLedgerProjection();
    const graph = emptyGraph();
    assert.equal(localCostLedgerIsAhead(local, server, graph), true);
  });

  it("does not treat deleted activities as ahead of server", () => {
    const local = emptyCostLedgerProjection();
    local.lineItems = [linkedActivityLine("server-line-1", "act-1", "Skytree")];
    const server = emptyCostLedgerProjection();
    const graph = graphWithoutActivities();
    assert.equal(localCostLedgerIsAhead(local, server, graph), false);
  });
});

describe("mergePreferLocalCostLedger", () => {
  it("appends local-only manual lines onto the server ledger", () => {
    const server = emptyCostLedgerProjection();
    server.lineItems = [manualLine("flight-1", "Flights")];
    const local = emptyCostLedgerProjection();
    local.lineItems = [
      manualLine("flight-1", "Flights"),
      manualLine("optimistic-2", "Travel insurance"),
    ];

    const merged = mergePreferLocalCostLedger(local, server);
    assert.equal(merged?.lineItems.length, 2);
    assert.equal(
      merged?.lineItems.some((line) => line.description === "Travel insurance"),
      true,
    );
  });

  it("keeps seeded activity lines when a stale server refresh omits them", () => {
    const server = emptyCostLedgerProjection();
    const local = emptyCostLedgerProjection();
    local.lineItems = [linkedActivityLine("server-line-1", "act-1", "Skytree")];

    const merged = mergePreferLocalCostLedger(local, server, { graph: emptyGraph() });
    assert.equal(merged?.lineItems.length, 1);
    assert.equal(merged?.lineItems[0]?.linkedActivityId, "act-1");
  });

  it("drops stale local activity rows after the calendar activity was removed", () => {
    const server = emptyCostLedgerProjection();
    const local = emptyCostLedgerProjection();
    local.lineItems = [linkedActivityLine("server-line-1", "act-1", "USJ")];

    const merged = mergePreferLocalCostLedger(local, server, { graph: graphWithoutActivities() });
    assert.equal(merged?.lineItems.length, 0);
  });

  it("prefers the server row when both snapshots include the same linked activity", () => {
    const server = emptyCostLedgerProjection();
    server.lineItems = [linkedActivityLine("db-line-1", "act-1", "Skytree")];
    const local = emptyCostLedgerProjection();
    local.lineItems = [
      linkedActivityLine("optimistic-activity-act-1", "act-1", "Skytree"),
    ];

    const merged = mergePreferLocalCostLedger(local, server, { graph: emptyGraph() });
    assert.equal(merged?.lineItems.length, 1);
    assert.equal(merged?.lineItems[0]?.id, "db-line-1");
  });
});
