"use client";

import { useMemo, useState } from "react";

import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  calendarSubgroups,
  canResyncParticipantFromMain,
  editGroupIdForLens,
  lensDisplayLabel,
  personalGroupIdForParticipant,
  planModeLabel,
  rosterParticipantIdsForGroup,
  sharedSubgroupMembers,
  type CalendarLens,
} from "@/lib/trip-engine/person-lens";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

import { TripConfirmModal } from "../shared/TripConfirmModal";

type PlanModeChoice = "overlay" | "independent";

function PlanModeModal(props: {
  title: string;
  subtitle: string;
  onChoose: (mode: PlanModeChoice) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">{props.title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{props.subtitle}</p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => props.onChoose("overlay")}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
          >
            <p className="text-sm font-medium text-zinc-900">Work from main itinerary</p>
            <p className="text-xs text-zinc-500">
              Small changes — inherit the group plan, override specific days
            </p>
          </button>
          <button
            type="button"
            onClick={() => props.onChoose("independent")}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
          >
            <p className="text-sm font-medium text-zinc-900">Start fresh</p>
            <p className="text-xs text-zinc-500">
              A separate plan — can be a completely different trip
            </p>
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

function PartySelectModal(props: {
  participants: RosterSummary["participants"];
  initialSelected: string[];
  onConfirm: (participantIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(props.initialSelected));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">Edit multiple together</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Calendar, transport, and accommodation changes apply to everyone selected.
        </p>
        <ul className="mt-4 max-h-64 space-y-1 overflow-y-auto">
          {props.participants.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <span className="text-sm font-medium text-zinc-900">{p.fullName}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={props.onCancel}
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size < 2}
            onClick={() => props.onConfirm([...selected])}
            className="flex-1 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function selectValueForLens(lens: CalendarLens): string {
  if (lens.kind === "whole_group") return "";
  if (lens.kind === "person") return `person:${lens.participantId}`;
  if (lens.kind === "subgroup") return `subgroup:${lens.groupId}`;
  return "party";
}

export function CalendarPersonLens(props: {
  graph: TripEntityGraph;
  roster: RosterSummary;
  lens: CalendarLens;
  activeGroupId: string;
  saving?: boolean;
  onLensChange: (lens: CalendarLens) => void;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onSwitchToPerson: (participantId: string) => void;
}) {
  const [pendingPersonId, setPendingPersonId] = useState<string | null>(null);
  const [pendingPartyIds, setPendingPartyIds] = useState<string[] | null>(null);
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [matchMainOpen, setMatchMainOpen] = useState(false);

  const participants = useMemo(
    () => props.roster.participants.filter((p) => p.role !== "host"),
    [props.roster.participants],
  );

  const subgroups = useMemo(() => calendarSubgroups(props.graph), [props.graph]);

  const lensParticipantId =
    props.lens.kind === "person" ? props.lens.participantId : null;

  const selectedPerson = lensParticipantId
    ? participants.find((p) => p.id === lensParticipantId) ?? null
    : null;

  const partyParticipantIds =
    props.lens.kind === "party" ? props.lens.participantIds : [];

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

  async function ensurePersonalGroups(
    participantIds: string[],
    mode: PlanModeChoice,
  ): Promise<boolean> {
    const commands: TripCommand[] = [];
    for (const participantId of participantIds) {
      const person = participants.find((p) => p.id === participantId);
      if (!person) continue;
      if (personalGroupIdForParticipant(props.graph, participantId)) continue;
      commands.push({
        type: "ensurePersonalGroup",
        participantId,
        participantName: person.fullName,
        mode,
      });
    }
    if (!commands.length) return true;
    return props.onDispatch(commands);
  }

  async function selectPerson(participantId: string) {
    const person = participants.find((p) => p.id === participantId);
    if (!person) return;

    const personal = personalGroupIdForParticipant(props.graph, participantId);
    const hasSubgroup = person.groupIds.some((gid) => gid !== props.graph.mainGroupId);

    if (!personal && !hasSubgroup) {
      setPendingPersonId(participantId);
      return;
    }

    props.onLensChange({ kind: "person", participantId });
  }

  async function selectSubgroup(groupId: string) {
    props.onLensChange({ kind: "subgroup", groupId });
  }

  async function confirmPlanMode(mode: PlanModeChoice) {
    const participantId = pendingPersonId;
    if (!participantId) return;
    const ok = await ensurePersonalGroups([participantId], mode);
    setPendingPersonId(null);
    if (!ok) return;
    props.onLensChange({ kind: "person", participantId });
    props.onSwitchToPerson(participantId);
  }

  async function confirmPartyPlanMode(mode: PlanModeChoice) {
    const ids = pendingPartyIds;
    if (!ids?.length) return;
    const ok = await ensurePersonalGroups(ids, mode);
    setPendingPartyIds(null);
    if (!ok) return;
    props.onLensChange({ kind: "party", participantIds: ids });
  }

  async function beginPartySelection(ids: string[]) {
    const needsPlan = ids.filter((id) => !personalGroupIdForParticipant(props.graph, id));
    if (needsPlan.length) {
      setPendingPartyIds(ids);
      return;
    }
    props.onLensChange({ kind: "party", participantIds: ids });
  }

  async function changeMode(mode: PlanModeChoice) {
    if (props.lens.kind === "party") {
      setModeMenuOpen(false);
      const commands: TripCommand[] = [];
      for (const participantId of props.lens.participantIds) {
        const groupId = personalGroupIdForParticipant(props.graph, participantId);
        if (groupId) {
          commands.push({ type: "setGroupInheritMode", groupId, mode });
        }
      }
      if (commands.length) await props.onDispatch(commands);
      return;
    }

    if (!selectedPerson) return;
    const groupId = personalGroupIdForParticipant(props.graph, selectedPerson.id);
    if (!groupId) {
      await confirmPlanMode(mode);
      return;
    }
    setModeMenuOpen(false);
    await props.onDispatch([{ type: "setGroupInheritMode", groupId, mode }]);
  }

  function modeChipText(): string {
    if (props.lens.kind === "party") return "Batch edit";
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
    setModeMenuOpen(false);
    setMatchMainOpen(true);
  }

  async function confirmMatchMainTrip() {
    if (!selectedPerson) return;
    const groupId = personalGroupIdForParticipant(props.graph, selectedPerson.id);
    if (!groupId) return;
    const ok = await props.onDispatch([{ type: "resetGroupFromMain", groupId }]);
    if (ok) setMatchMainOpen(false);
  }

  const lensBusy = Boolean(props.saving);
  const lensLabel = lensDisplayLabel(props.lens, props.graph, props.roster);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          id="trip-os-calendar-lens"
          aria-label="Viewing calendar"
          value={selectValueForLens(props.lens)}
          disabled={lensBusy}
          onChange={(e) => {
            if (lensBusy) return;
            const value = e.target.value;
            if (!value) {
              props.onLensChange({ kind: "whole_group" });
              return;
            }
            if (value === "party") return;
            if (value.startsWith("subgroup:")) {
              void selectSubgroup(value.slice("subgroup:".length));
              return;
            }
            if (value.startsWith("person:")) {
              void selectPerson(value.slice("person:".length));
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm font-medium text-zinc-900 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Whole group</option>
          {subgroups.length ? (
            <optgroup label="Travel parties">
              {subgroups.map((group) => {
                const count = rosterParticipantIdsForGroup(props.roster, group.id).length;
                return (
                  <option key={group.id} value={`subgroup:${group.id}`}>
                    {group.name}
                    {count > 0 ? ` (${count})` : ""}
                  </option>
                );
              })}
            </optgroup>
          ) : null}
          <optgroup label="Individuals">
            {participants.map((p) => (
              <option key={p.id} value={`person:${p.id}`}>
                {p.fullName}
              </option>
            ))}
          </optgroup>
          {props.lens.kind === "party" ? (
            <option value="party">{lensLabel}</option>
          ) : null}
        </select>
        <button
          type="button"
          disabled={lensBusy}
          onClick={() => setPartyPickerOpen(true)}
          className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-2 text-xs font-medium text-zinc-700 hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-50"
        >
          Edit together…
        </button>
      </div>

      {props.lens.kind === "party" ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] leading-snug text-violet-900">
          Editing for: <span className="font-semibold">{lensLabel}</span>
        </p>
      ) : props.lens.kind === "person" ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] leading-snug text-violet-900">
          Editing for: <span className="font-semibold">{lensLabel}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {selectedPerson || props.lens.kind === "party" ? (
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
                {canResyncMain && props.lens.kind === "person" ? (
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

      {sharedWith.length > 0 && selectedPerson ? (
        <p className="max-w-[14rem] text-right text-[10px] text-amber-700">
          Also affects {sharedWith.join(", ")}
        </p>
      ) : null}

      {partyPickerOpen ? (
        <PartySelectModal
          participants={participants}
          initialSelected={
            props.lens.kind === "party"
              ? props.lens.participantIds
              : lensParticipantId
                ? [lensParticipantId]
                : []
          }
          onConfirm={(ids) => {
            setPartyPickerOpen(false);
            void beginPartySelection(ids);
          }}
          onCancel={() => setPartyPickerOpen(false)}
        />
      ) : null}

      {pendingPersonId ? (
        <PlanModeModal
          title={`Adjust ${participants.find((p) => p.id === pendingPersonId)?.fullName ?? "Participant"}'s itinerary`}
          subtitle="How should their plan relate to the main group?"
          onChoose={(mode) => void confirmPlanMode(mode)}
          onCancel={() => setPendingPersonId(null)}
        />
      ) : null}

      {pendingPartyIds ? (
        <PlanModeModal
          title="Adjust plans for selected travellers"
          subtitle={`Apply the same starting point to ${pendingPartyIds.length} people.`}
          onChoose={(mode) => void confirmPartyPlanMode(mode)}
          onCancel={() => setPendingPartyIds(null)}
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
