import { detectAirportTransfers } from "@/lib/host/wizard/detect-airport-transfers";
import type { DayPlaceDraft, IntercityLegDraft } from "@/lib/host/wizard/types";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { SetupStatusItem } from "@/lib/host/setup/section-status-items";

/** Rough transfer duration label for airport-to-hotel gaps (v1 stub). */
export function estimateTransferDurationLabel(): string {
  return "~50 min";
}

export function airportTransferStatusItems(state: TripSetupState): SetupStatusItem[] {
  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const draft = {
    outboundLegs: state.outboundLegs,
    returnLegs: state.returnLegs,
    intercityLegs: [] as IntercityLegDraft[],
  };
  const trip = {
    startDate: state.basics.startDate,
    endDate: state.basics.endDate,
    departureCity: state.basics.departureCity,
    returnCity: state.basics.returnCity,
  };

  const transfers = detectAirportTransfers(mainDays, draft, trip);
  const existingSurface = new Set(
    state.intercityLegs
      .filter((leg) => leg.surfaceOnly && leg.anchorLegId)
      .map((leg) => leg.anchorLegId!),
  );

  return transfers
    .filter((transfer) => !existingSurface.has(transfer.anchorLegId))
    .map((transfer) => ({
      id: `airport-transfer-${transfer.anchorLegId}`,
      label: `${transfer.fromCity} → ${transfer.toCity}`,
      prompt: "How are you getting from the airport to your hotel?",
      status: "todo" as const,
      value: `${estimateTransferDurationLabel()} — something to sort out`,
      message: "Choose how the group will transfer",
      kind: "airport-transfer" as const,
      anchorLegId: transfer.anchorLegId,
      transferFrom: transfer.fromCity,
      transferTo: transfer.toCity,
      transferDate: transfer.date,
      transferLegKind: transfer.legKind,
    }));
}

export function findSurfaceTransferLeg(
  intercityLegs: IntercityLegDraft[],
  anchorLegId: string,
): IntercityLegDraft | undefined {
  return intercityLegs.find(
    (leg) => leg.surfaceOnly && leg.anchorLegId === anchorLegId,
  );
}

export function dayPlacesForTransferDetection(state: TripSetupState): DayPlaceDraft[] {
  return state.dayPlacesByGroupId[state.mainGroupId] ?? [];
}
