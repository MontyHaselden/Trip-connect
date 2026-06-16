"use client";

import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { intercityPromptForMove } from "@/lib/groups/detect-group-city-moves";
import { detectGroupCityMoves } from "@/lib/groups/detect-group-city-moves";
import type { SetupStatusItem } from "@/lib/host/setup/section-status-items";
import { transportStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";

import { AirportTransferPanel } from "./AirportTransferPanel";
import { SetupPlanesPanel, type TransportFlightFocus } from "./SetupPlanesPanel";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";
import { SetupTransportModePanel } from "./SetupTransportModePanel";
import type { TransportType } from "@/lib/host/wizard/types";

export type TransportWorkspaceTab = "overview" | TransportType;

const ADDABLE_MODES: Array<{ id: TransportType; label: string }> = [
  { id: "plane", label: "Planes" },
  { id: "train", label: "Trains" },
  { id: "bus", label: "Buses" },
  { id: "ferry", label: "Ferries" },
  { id: "coach", label: "Coaches" },
  { id: "car", label: "Cars" },
  { id: "taxi", label: "Taxis" },
  { id: "other", label: "Other" },
];

const MODE_LABEL: Partial<Record<TransportType, string>> = {
  plane: "Planes",
  train: "Trains",
  bus: "Buses",
  ferry: "Ferries",
  coach: "Coaches",
  car: "Cars",
  taxi: "Taxis",
  walking: "Walking",
  other: "Other",
  unsure: "Unsure",
};

export function SetupTransportWorkspace(props: {
  state: TripSetupState;
  activeGroupId: string;
  sectionLabel?: string;
  sectionMessage?: string;
  roster?: ComponentProps<typeof SetupPlanesPanel>["roster"];
  isMain: boolean;
  flightFocus?: TransportFlightFocus | null;
  onFlightScheduled?: (travelDate: string) => void;
  onCommitTransport: (
    updates: Partial<Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">>,
  ) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const {
    state,
    activeGroupId,
    sectionLabel,
    sectionMessage,
    roster,
    isMain,
    flightFocus,
    onFlightScheduled,
    onCommitTransport,
    onSave,
    saving,
  } = props;

  const [tab, setTab] = useState<TransportWorkspaceTab>("plane");
  const [enabledModes, setEnabledModes] = useState<TransportType[]>(["plane"]);
  const [addOpen, setAddOpen] = useState(false);
  const [activeTransfer, setActiveTransfer] = useState<SetupStatusItem | null>(null);

  useEffect(() => {
    if (flightFocus?.date) setTab("plane");
  }, [flightFocus?.date, flightFocus?.city]);

  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const groupDays = state.dayPlacesByGroupId[activeGroupId] ?? [];
  const cityMoves = useMemo(
    () => detectGroupCityMoves(mainDays, groupDays, isMain),
    [mainDays, groupDays, isMain],
  );

  const statusItems = useMemo(
    () => transportStatusItems(state, activeGroupId),
    [state, activeGroupId],
  );

  function enableMode(mode: TransportType) {
    setEnabledModes((current) => (current.includes(mode) ? current : [...current, mode]));
    setTab(mode);
    setAddOpen(false);
  }

  const visibleTabs = enabledModes.filter((mode) => mode !== "unsure" && mode !== "walking");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-4 py-2">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </TabButton>
        {visibleTabs.map((mode) => (
          <TabButton key={mode} active={tab === mode} onClick={() => setTab(mode)}>
            {MODE_LABEL[mode] ?? mode}
          </TabButton>
        ))}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            aria-label="Add transport mode"
          >
            +
          </button>
          {addOpen ? (
            <div className="absolute left-0 top-10 z-20 min-w-[10rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
              {ADDABLE_MODES.filter((mode) => !enabledModes.includes(mode.id)).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => enableMode(mode.id)}
                  className="block w-full px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
                >
                  {mode.label}
                </button>
              ))}
              {!ADDABLE_MODES.some((mode) => !enabledModes.includes(mode.id)) ? (
                <p className="px-3 py-2 text-xs text-zinc-500">All modes added</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "overview" ? (
          <div className="px-2 py-4">
            {activeTransfer ? (
              <AirportTransferPanel
                item={activeTransfer}
                state={state}
                onClose={() => setActiveTransfer(null)}
                onSave={(leg) => {
                  onCommitTransport({ intercityLegs: [...state.intercityLegs, leg] });
                  setActiveTransfer(null);
                }}
              />
            ) : null}

            <SetupSectionStatusPanel
              section={
                sectionLabel
                  ? {
                      id: "transport",
                      label: sectionLabel,
                      status: "todo",
                      message: sectionMessage,
                    }
                  : undefined
              }
              items={statusItems}
              onItemClick={(item) => {
                if (item.kind === "airport-transfer") setActiveTransfer(item);
              }}
            />

            {!isMain && cityMoves.length ? (
              <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                {cityMoves.map((move) => (
                  <p key={`${move.date}-${move.toCity}`}>{intercityPromptForMove(move)}</p>
                ))}
              </div>
            ) : null}

            <p className="mx-5 mt-6 text-xs text-zinc-400">
              Add flights on the Planes tab — the calendar paints travel days automatically so
              accommodation can sit beside each leg.
            </p>
          </div>
        ) : null}

        {tab === "plane" ? (
          <SetupPlanesPanel
            state={state}
            activeGroupId={activeGroupId}
            isMain={isMain}
            focus={flightFocus}
            roster={roster}
            outboundLegs={state.outboundLegs}
            returnLegs={state.returnLegs}
            intercityLegs={state.intercityLegs}
            onOutboundChange={(outboundLegs) => onCommitTransport({ outboundLegs })}
            onReturnChange={(returnLegs) => onCommitTransport({ returnLegs })}
            onIntercityChange={(intercityLegs) => onCommitTransport({ intercityLegs })}
            onCommitClassified={onCommitTransport}
            onFlightScheduled={onFlightScheduled}
          />
        ) : null}

        {tab !== "overview" && tab !== "plane" ? (
          <SetupTransportModePanel
            mode={tab}
            state={state}
            activeGroupId={activeGroupId}
            isMain={isMain}
            roster={roster}
            onCommitTransport={onCommitTransport}
          />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-zinc-200 px-6 py-4">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="h-10 w-full max-w-2xl rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save transport"}
        </button>
      </div>
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        props.active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
      ].join(" ")}
    >
      {props.children}
    </button>
  );
}
