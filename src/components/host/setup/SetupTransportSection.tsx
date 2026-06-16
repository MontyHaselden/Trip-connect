"use client";

import { useEffect, useState } from "react";

import { groupIntercityLegs, mainIntercityLegs } from "@/lib/host/setup/entity-scope";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import type { TripSetupState } from "@/lib/host/setup/types";

import { PropagateChangeModal, type PropagateScope } from "./PropagateChangeModal";
import { SetupTransportWorkspace } from "./SetupTransportWorkspace";
import type { TransportFlightFocus } from "./SetupPlanesPanel";

export function SetupTransportSection(props: {
  tripId: string;
  inviteCode: string;
  state: TripSetupState;
  activeGroupId: string;
  sectionLabel?: string;
  sectionMessage?: string;
  flightFocus?: TransportFlightFocus | null;
  onFlightScheduled?: (travelDate: string) => void;
  onChange: (next: TripSetupState) => void;
  onSave: (scope?: PropagateScope) => void;
  saving: boolean;
}) {
  const {
    inviteCode,
    state,
    activeGroupId,
    sectionLabel,
    sectionMessage,
    flightFocus,
    onFlightScheduled,
    onChange,
    onSave,
    saving,
  } = props;
  const isMain = activeGroupId === state.mainGroupId;
  const [roster, setRoster] = useState<{
    groups: Array<{ id: string; name: string }>;
    participants: Array<{ id: string; fullName: string }>;
    rooms: Array<{ id: string; roomName: string }>;
  }>({ groups: [], participants: [], rooms: [] });
  const [propagateOpen, setPropagateOpen] = useState(false);

  useEffect(() => {
    void fetch(`/api/host/${encodeURIComponent(inviteCode)}/roster`)
      .then((r) => r.json())
      .then((body) => {
        setRoster({
          groups: body.groups ?? [],
          participants: body.participants ?? [],
          rooms: body.rooms ?? [],
        });
      })
      .catch(() => undefined);
  }, [inviteCode]);

  const visibleIntercity = isMain
    ? mainIntercityLegs(state)
    : groupIntercityLegs(state, activeGroupId);

  function commitTransport(
    updates: Partial<Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">>,
  ) {
    onChange(applySetupTransportChange(state, updates));
  }

  function hasLinkedCopies(): boolean {
    return visibleIntercity.some((v) =>
      state.intercityLegs.some((other) => other.sourceEntityId === v.id),
    );
  }

  function handleSaveClick() {
    if (isMain && state.groups.some((g) => !g.isMain) && hasLinkedCopies()) {
      setPropagateOpen(true);
      return;
    }
    onSave();
  }

  async function handlePropagate(scope: PropagateScope) {
    setPropagateOpen(false);
    onSave(scope);
  }

  return (
    <>
      <SetupTransportWorkspace
        state={state}
        activeGroupId={activeGroupId}
        sectionLabel={sectionLabel}
        sectionMessage={sectionMessage}
        roster={roster}
        isMain={isMain}
        flightFocus={flightFocus}
        onFlightScheduled={onFlightScheduled}
        onCommitTransport={commitTransport}
        onSave={handleSaveClick}
        saving={saving}
      />

      <PropagateChangeModal
        open={propagateOpen}
        groupNames={state.groups.filter((g) => !g.isMain).map((g) => g.name)}
        onClose={() => setPropagateOpen(false)}
        onConfirm={(scope) => void handlePropagate(scope)}
      />
    </>
  );
}
