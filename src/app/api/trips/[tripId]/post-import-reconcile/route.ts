import { NextResponse } from "next/server";

import { buildFillGapsProposal } from "@/lib/ai/trip-chat-deterministic";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { hostApiError } from "@/lib/host/api-errors";
import {
  formatPostImportAssistantMessage,
  reconcileImportedSetupState,
  summarizeSetupCalendarGaps,
} from "@/lib/host/import/post-import-reconcile";
import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { loadTripSetupState } from "@/lib/host/setup/load-setup-state";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { analyzeImportGaps } from "@/lib/host/wizard/analyze-import-gaps";
import { loadTripGraph } from "@/lib/trip-engine";
import { applyCommandBatch } from "@/lib/trip-engine/apply-command-batch";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const hostId = await requireHostSessionHostId();
    const trip = await getTripByIdForHost(hostId, tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const setupState = await loadTripSetupState(tripId);
    if (!setupState) {
      return NextResponse.json({ error: "Trip setup not found." }, { status: 404 });
    }

    const { state: reconciled, filledDayCount } = reconcileImportedSetupState(setupState);
    await applyTripSetupState(tripId, syncTripBoundsFromContent(reconciled), {
      skipWizardItineraryItems: true,
      syncTransportItems: true,
      syncAccommodationItems: false,
    });

    const calendarGaps = summarizeSetupCalendarGaps(reconciled);
    const importGaps = await analyzeImportGaps(tripId);

    const graph = await loadTripGraph(tripId);
    let fillProposal = null;
    if (graph && calendarGaps.unpaintedDates.length) {
      const proposal = buildFillGapsProposal(graph, graph.mainGroupId);
      if (proposal.proposedCommands.length) {
        const dryRun = applyCommandBatch(graph, proposal.proposedCommands);
        if (!dryRun.conflicts.some((c) => c.severity === "blocking")) {
          fillProposal = {
            assistantReply: proposal.assistantReply,
            proposedCommands: proposal.proposedCommands,
            commandSummaries: proposal.commandSummaries,
          };
        }
      }
    }

    const assistantReply = formatPostImportAssistantMessage({
      itemsCreated: 0,
      filledDayCount,
      calendarGaps,
      importGapMessages: importGaps.map((gap) => gap.message),
    });

    return NextResponse.json({
      filledDayCount,
      calendarGaps,
      importGaps,
      assistantReply,
      fillProposal,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
