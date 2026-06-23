import { inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { costLineItems } from "@/lib/db/schema";
import { loadTripGraph } from "@/lib/trip-engine";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

import { persistCommands } from "../persist-command";

import {
  dismissalKeyFromLine,
  dismissFromFinance,
  type FinanceDismissalKey,
} from "./finance-dismissals";
import { loadCostLedgerRaw } from "./load-cost-ledger";
import type { CostLineItemDraft } from "./types";

export type BulkFinanceDeleteMode = "financeOnly" | "removeFromTrip";

export function buildRemoveFromTripCommands(
  graph: TripEntityGraph,
  lines: CostLineItemDraft[],
): TripCommand[] {
  const commands: TripCommand[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (line.linkedStayId) {
      const key = `stay:${line.linkedStayId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const stay = graph.accommodationStays.find((s) => s.id === line.linkedStayId);
      commands.push({
        type: "removeStay",
        groupId: stay?.originGroupId ?? graph.mainGroupId,
        stayId: line.linkedStayId,
      });
      continue;
    }

    if (line.linkedTransportLegId) {
      const legId = line.linkedTransportLegId;
      const key = `leg:${legId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const bucket = graph.outboundLegs.some((l) => l.id === legId)
        ? "outbound"
        : graph.returnLegs.some((l) => l.id === legId)
          ? "return"
          : "intercity";
      commands.push({
        type: "removeTransportLeg",
        groupId: graph.mainGroupId,
        bucket,
        legId,
      });
      continue;
    }

    if (line.linkedActivityId) {
      const key = `activity:${line.linkedActivityId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const activity = graph.activities.find((a) => a.id === line.linkedActivityId);
      commands.push({
        type: "removeActivity",
        groupId: activity?.originGroupId ?? graph.mainGroupId,
        activityId: line.linkedActivityId,
      });
    }
  }

  return commands;
}

/** Delete multiple finance rows in one pass (single ledger reload on the API). */
export async function bulkDeleteFinanceLines(
  tripId: string,
  lineIds: string[],
  mode: BulkFinanceDeleteMode,
): Promise<void> {
  const uniqueIds = [...new Set(lineIds)];
  if (!uniqueIds.length) return;

  const raw = await loadCostLedgerRaw(tripId);
  const lines = raw.lineItems.filter((line) => uniqueIds.includes(line.id));
  if (!lines.length) return;

  if (mode === "financeOnly") {
    const dismissalKeys = new Map<string, FinanceDismissalKey>();
    for (const line of lines) {
      const key = dismissalKeyFromLine(line);
      if (key) dismissalKeys.set(`${key.entityType}:${key.entityId}`, key);
    }
    await Promise.all(
      [...dismissalKeys.values()].map((key) => dismissFromFinance(tripId, key)),
    );
    await db.delete(costLineItems).where(inArray(costLineItems.id, uniqueIds));
    return;
  }

  const graph = await loadTripGraph(tripId);
  if (!graph) throw new Error("Trip not found.");

  const commands = buildRemoveFromTripCommands(graph, lines);
  const unlinkedIds = lines
    .filter((line) => !dismissalKeyFromLine(line))
    .map((line) => line.id);

  if (commands.length) {
    await persistCommands(tripId, graph, commands);
  }
  if (unlinkedIds.length) {
    await db.delete(costLineItems).where(inArray(costLineItems.id, unlinkedIds));
  }
}
