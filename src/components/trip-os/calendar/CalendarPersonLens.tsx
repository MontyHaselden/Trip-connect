"use client";

import { useMemo, useState } from "react";

import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  canResyncParticipantFromMain,
  editGroupIdForLens,
  planModeLabel,
  sharedSubgroupMembers,
  type CalendarLens,
} from "@/lib/trip-engine/person-lens";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

import { TripConfirmModal } from "../shared/TripConfirmModal";

type PlanModeChoice = "overlay" | "independent";

function PlanModeModal(props: {
  participantName: string;
  onChoose: (mode: PlanModeChoice) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">
          Adjust {props.participantName}&apos;s itinerary
        </h3>
        <p className="mt-1 text-sm text-zinc-500">
          How should their plan relate to the main group?
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => props.onChoose("overlay")}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
          >
            <p className="text-sm font-medium text-zinc-900">Work from main itinerary</p>
            <p className="text-xs text-zinc-500">Small changes — inherit the group plan, override specific days</p>
          </button>
          <button
            type="button"
            onClick={() => props.onChoose("independent")}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
          >
            <p className="text-sm font-medium text-zinc-900">Start fresh</p>
            <p className="text-xs text-zinc-500">A separate plan — can be a completely different trip</p>
          </button>
        </div>
        <button
          type="button"
          onClick={props.onCancel}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CalendarPersonLens(props: {
  graph: TripEntityGraph;
  roster: RosterSummary;
  lens: CalendarLens;
  activeGroupId: string;
  saving?: boolean;
  onLensChange: (lens: CalendarLens) => void;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onSwitchGroup: (groupId: string) => void;
  onSwitchToPerson: (participantId: string) => void;
}) {
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [matchMainOpen, setMatchMainOpen] = useState(false);

  const participants = useMemo(
    () => props.roster.participants.filter((p) => p.role !== "host"),
    [props.roster.participants],
  );

  const lensParticipantId = props.lens.kind === "person" ? props.lens.participantId : null;

  const selectedPerson = lensParticipantId
    ? participants.find((p) => p.id === lensParticipantId) ?? null
    : null;

  const modeLabel =
    selectedPerson ? planModeLabel(props.graph, selectedPerson.id) : null;

  const canResyncMain = selectedPerson
    ? canResyncParticipantFromMain(props.graph, selectedPerson.id)
    : false;

  const resyncMainLabel =
    modeLabel === "following_main" ? "Re-sync with main group" : "Match main trip";

  const sharedWith = useMemo(() => {
    if (!selectedPerson || props.lens.kind !== "person") return [];
    const gid = editGroupIdForLens(props.graph, props.lens, props.roster);
    const personal = props.graph.groups.find((g) => g.id === gid);
    if (personal?.personalForParticipantId) return [];
    return sharedSubgroupMembers(props.roster, gid, selectedPerson.id);
  }, [props.graph, props.lens, props.roster, selectedPerson]);

  async function selectPerson(participantId: string) {
    const person = participants.find((p) => p.id === participantId);
    if (!person) return;

    const personal = props.graph.groups.find(
      (g) => g.personalForParticipantId === participantId && !g.isMain,
    );
    const hasSubgroup = person.groupIds.some((gid) => gid !== props.graph.mainGroupId);

    if (!personal && !hasSubgroup) {
      setPendingPersonId(participantId);
      return;
    }

    const lens: CalendarLens = { kind: "person", participantId };
    props.onLensChange(lens);
    props.onSwitchGroup(editGroupIdForLens(props.graph, lens, props.roster));
  }

  async function confirmPlanMode(mode: PlanModeChoice) {
    const participantId = pendingPersonId;
    if (!participantId) return;
    const person = participants.find((p) => p.id === participantId);
    if (!person) return;

    const ok = await props.onDispatch([
      {
        type: "ensurePersonalGroup",
        participantId,
        participantName: person.fullName,
        mode,
      },
    ]);
    setPendingPersonId(null);
    if (!ok) return;

    const lens: CalendarLens = { kind: "person", participantId };
    props.onLensChange(lens);
    props.onSwitchToPerson(participantId);
  }

  async function changeMode(mode: PlanModeChoice) {
    if (!selectedPerson) return;
    const group = props.graph.groups.find(
      (g) => g.personalForParticipantId === selectedPerson.id && !g.isMain,
    );
    if (!group) {
      await confirmPlanMode(mode);
      return;
    }
    setModeMenuOpen(false);
    await props.onDispatch([
      { type: "setGroupInheritMode", groupId: group.id, mode },
    ]);
  }

  function modeChipText(): string {
    switch (modeLabel) {
      case "custom_independent":
        return "Separate plan";
      case "custom_overlay":
        return "Custom (off main)";
      case "custom_locations":
        return "Different cities";
      default:
        return "Following main";
    }
  }

  function openMatchMainConfirm() {
    if (!selectedPerson) return;
    const group = props.graph.groups.find(
      (g) => g.personalForParticipantId === selectedPerson.id && !g.isMain,
    );
    if (!group) return;
    setModeMenuOpen(false);
    setMatchMainOpen(true);
  }

  async function confirmMatchMainTrip() {
    if (!selectedPerson) return;
    const group = props.graph.groups.find(
      (g) => g.personalForParticipantId === selectedPerson.id && !g.isMain,
    );
    if (!group) return;
    const ok = await props.onDispatch([{ type: "resetGroupFromMain", groupId: group.id }]);
    if (ok) setMatchMainOpen(false);
  }

  const lensBusy = Boolean(props.saving);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <select
          value={props.lens.kind === "whole_group" ? "" : props.lens.participantId}
          disabled={lensBusy}
          onChange={(e) => {
            if (lensBusy) return;
            const id = e.target.value;
            if (!id) {
              props.onLensChange({ kind: "whole_group" });
              props.onSwitchGroup(props.graph.mainGroupId);
              return;
            }
            void selectPerson(id);
          }}
          className="rounded-full border-0 bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="">Whole group</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>

        {selectedPerson ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setModeMenuOpen((o) => !o)}
              className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-800"
            >
              {modeChipText()}
            </button>
            {modeMenuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-zinc-50"
                  onClick={() => void changeMode("overlay")}
                >
                  Work from main
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-zinc-50"
                  onClick={() => void changeMode("independent")}
                >
                  Separate plan
                </button>
                {canResyncMain ? (
                  <button
                    type="button"
                    className="block w-full border-t border-zinc-100 px-3 py-2 text-left text-xs font-medium text-violet-800 hover:bg-violet-50"
                    onClick={() => openMatchMainConfirm()}
                  >
                    {resyncMainLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {lensBusy ? (
        <p className="max-w-[14rem] text-right text-[10px] text-zinc-500">Saving…</p>
      ) : null}

      {sharedWith.length > 0 && selectedPerson ? (
        <p className="max-w-[14rem] text-right text-[10px] text-amber-700">
          Also affects {sharedWith.join(", ")}
        </p>
      ) : null}

      {pendingPersonId ? (
        <PlanModeModal
          participantName={
            participants.find((p) => p.id === pendingPersonId)?.fullName ?? "Participant"
          }
          onChoose={(mode) => void confirmPlanMode(mode)}
          onCancel={() => setPendingPersonId(null)}
        />
      ) : null}

      {matchMainOpen && selectedPerson ? (
        <TripConfirmModal
          open
          eyebrow="Participant plan"
          title={
            modeLabel === "following_main"
              ? `Re-sync ${selectedPerson.fullName} with the main group?`
              : `Match ${selectedPerson.fullName} to the main trip?`
          }
          description={
            modeLabel === "following_main"
              ? "This clears any leftover custom locations, stays, or activities on their personal plan so they fully match the whole group trip again."
              : "Their custom locations, stays, and activities will be removed. They'll follow the whole group plan again."
          }
          tone="warning"
          cancelLabel={modeLabel === "following_main" ? "Cancel" : "Keep custom plan"}
          confirmLabel={resyncMainLabel}
          confirmLoading={lensBusy}
          onCancel={() => setMatchMainOpen(false)}
          onConfirm={() => void confirmMatchMainTrip()}
        />
      ) : null}
    </div>
  );
}
