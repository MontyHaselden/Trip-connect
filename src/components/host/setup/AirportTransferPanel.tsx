"use client";

import { estimateTransferDurationLabel } from "@/lib/host/setup/airport-transfer-todos";
import type { SetupStatusItem } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { IntercityLegDraft, TransportType } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

const MODES: Array<{ id: TransportType; label: string }> = [
  { id: "train", label: "Train" },
  { id: "bus", label: "Bus" },
  { id: "taxi", label: "Taxi / private transfer" },
  { id: "unsure", label: "Not sure yet" },
];

export function AirportTransferPanel(props: {
  item: SetupStatusItem;
  state: TripSetupState;
  onSave: (leg: IntercityLegDraft) => void;
  onClose: () => void;
}) {
  const { item, onSave, onClose } = props;

  return (
    <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Transfer to sort out
          </p>
          <h3 className="mt-1 text-sm font-semibold text-amber-950">{item.label}</h3>
          <p className="mt-1 text-sm text-amber-900">
            {estimateTransferDurationLabel()} from airport to hotel — how is the group getting
            there?
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-amber-800 hover:underline"
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() =>
              onSave({
                id: newId(),
                transportType: mode.id,
                bookingStatus: "not_booked",
                travelDate: item.transferDate ?? "",
                arrivalDate: null,
                departureTime: null,
                arrivalTime: null,
                fromCity: item.transferFrom ?? "",
                toCity: item.transferTo ?? "",
                fromStation: null,
                toStation: null,
                operator: null,
                referenceNumber: null,
                flightNumber: null,
                notes: null,
                intercityFromCity: item.transferFrom ?? "",
                intercityToCity: item.transferTo ?? "",
                legKind: item.transferLegKind,
                anchorLegId: item.anchorLegId ?? null,
                surfaceOnly: true,
                originGroupId: props.state.mainGroupId,
              })
            }
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100"
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-amber-200/80 pt-3">
        <button
          type="button"
          disabled
          className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500"
          title="Available on Pro"
        >
          Find public transport · Pro
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-500"
          title="Available on Pro"
        >
          Airport shuttle · Pro
        </button>
      </div>
    </div>
  );
}
