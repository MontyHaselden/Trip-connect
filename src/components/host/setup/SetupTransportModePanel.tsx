"use client";

import { TransportLegForm } from "@/components/host/wizard/shared/TransportLegForm";
import {
  groupIntercityLegs,
  mainIntercityLegs,
  mergeIntercityLegs,
} from "@/lib/host/setup/entity-scope";
import type { TripSetupState } from "@/lib/host/setup/types";
import { chainedTransportLeg, connectionLegHint } from "@/lib/host/wizard/leg-chain";
import type { IntercityLegDraft, TransportLegDraft, TransportType } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

const MODE_HINT: Partial<Record<TransportType, string>> = {
  train: "Add train legs in order. Connections continue from the previous arrival city.",
  bus: "Add bus legs for overland transfers.",
  ferry: "Add ferry crossings between ports.",
  coach: "Add coach legs for group road transfers.",
  car: "Add car or self-drive legs.",
  taxi: "Add taxi or shuttle legs.",
  other: "Add other transport legs.",
};

export function SetupTransportModePanel(props: {
  mode: TransportType;
  state: TripSetupState;
  activeGroupId: string;
  isMain: boolean;
  roster?: {
    groups: Array<{ id: string; name: string }>;
    participants: Array<{ id: string; fullName: string }>;
    rooms?: Array<{ id: string; roomName: string }>;
  };
  onCommitTransport: (
    updates: Partial<Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">>,
  ) => void;
}) {
  const { mode, state, activeGroupId, isMain, roster, onCommitTransport } = props;
  const visibleIntercity = isMain
    ? mainIntercityLegs(state)
    : groupIntercityLegs(state, activeGroupId);

  const modeIntercity = visibleIntercity.filter((leg) => leg.transportType === mode);

  function updateIntercity(index: number, next: IntercityLegDraft) {
    const legs = [...visibleIntercity];
    const modeLeg = modeIntercity[index];
    if (!modeLeg) return;
    const absoluteIndex = legs.findIndex((leg) => leg.id === modeLeg.id);
    if (absoluteIndex < 0) return;
    legs[absoluteIndex] = next;
    onCommitTransport({
      intercityLegs: isMain
        ? mergeIntercityLegs(state, state.mainGroupId, legs)
        : mergeIntercityLegs(state, activeGroupId, legs),
    });
  }

  function addLeg() {
    const previous = modeIntercity[modeIntercity.length - 1];
    const leg: IntercityLegDraft = {
      ...chainedTransportLeg(previous),
      id: newId(),
      transportType: mode,
      intercityFromCity: previous?.toCity.trim() || "",
      intercityToCity: "",
      originGroupId: isMain ? state.mainGroupId : activeGroupId,
    };
    onCommitTransport({ intercityLegs: [...state.intercityLegs, leg] });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{mode}</p>
        <h2 className="text-xl font-semibold capitalize text-zinc-900">{mode} legs</h2>
        <p className="text-sm text-zinc-600">{MODE_HINT[mode]}</p>
      </header>

      {modeIntercity.length === 0 ? (
        <p className="text-sm text-zinc-500">No {mode} legs yet.</p>
      ) : (
        modeIntercity.map((leg, index) => (
          <TransportLegForm
            key={leg.id}
            leg={leg}
            legTitle={`${leg.intercityFromCity || leg.fromCity || "Origin"} → ${
              leg.intercityToCity || leg.toCity || "Destination"
            }`}
            legHint={connectionLegHint(modeIntercity[index - 1] as TransportLegDraft | undefined)}
            countryNames={state.basics.destinationCountries}
            roster={roster}
            onChange={(next) =>
              updateIntercity(index, {
                ...next,
                intercityFromCity: leg.intercityFromCity,
                intercityToCity: leg.intercityToCity,
                originGroupId: leg.originGroupId,
              })
            }
          />
        ))
      )}

      <button
        type="button"
        onClick={addLeg}
        className="text-xs font-medium text-sky-800 hover:underline"
      >
        + Add {mode} leg
      </button>
    </div>
  );
}
