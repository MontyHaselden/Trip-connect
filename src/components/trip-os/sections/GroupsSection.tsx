"use client";

import { useState } from "react";

import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { isCalendarSubgroup, rosterParticipantIdsForGroup } from "@/lib/trip-engine/person-lens";

import { AsyncButton } from "../shared/AsyncButton";
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

export function GroupsSection(props: {
  graph: TripEntityGraph;
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };
  const [name, setName] = useState("");
  const [type, setType] = useState("split_travel");

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Groups"
      description="Create a travel party for people sharing the same flights or city changes. Assign members in Users, then pick the party from the calendar lens."
    >
      <ul className="space-y-2">
        {props.graph.groups.map((g) => {
          const memberIds = isCalendarSubgroup(g)
            ? rosterParticipantIdsForGroup(roster, g.id)
            : [];
          const memberNames = memberIds
            .map((id) => roster.participants.find((p) => p.id === id)?.fullName?.trim())
            .filter(Boolean);
          return (
          <li
            key={g.id}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="font-medium text-zinc-900">
                {g.name}
                {g.isMain ? " (main)" : ""}
              </p>
              <p className="text-sm text-zinc-500">
                {g.type}
                {memberNames.length ? ` · ${memberNames.join(", ")}` : ""}
              </p>
            </div>
            {!g.isMain ? (
              <AsyncButton
                loading={props.saving}
                loadingLabel="Removing…"
                onClick={() => void props.onDispatch([{ type: "deleteGroup", groupId: g.id }])}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </AsyncButton>
            ) : null}
          </li>
          );
        })}
      </ul>
      <TripSoftPanel title="Create travel party">
        <p className="mb-3 text-xs text-zinc-500">
          Example: &quot;Tottori side trip&quot; for everyone flying Tokyo → Tottori together. Add
          flights once on that party&apos;s calendar instead of four separate sections.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <TripInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" />
          <select value={type} onChange={(e) => setType(e.target.value)} className={tripFieldClass}>
            <option value="split_travel">Split travel</option>
            <option value="activity">Activity</option>
            <option value="accommodation">Accommodation</option>
            <option value="other">Other</option>
          </select>
        </div>
        <TripPrimaryButton
          onClick={() => {
            if (!name.trim()) return;
            void props.onDispatch([{ type: "createGroup", name: name.trim(), groupType: type }]);
            setName("");
          }}
          disabled={props.saving}
          className="mt-4"
        >
          {props.saving ? "Creating…" : "Create group"}
        </TripPrimaryButton>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
