"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { AsyncButton } from "../shared/AsyncButton";
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";

export function GroupsSection(props: {
  graph: TripEntityGraph;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("split_travel");

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Groups"
      description="Main group plus subgroup overlays for split travel."
    >
      <ul className="space-y-2">
        {props.graph.groups.map((g) => (
          <li
            key={g.id}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="font-medium text-zinc-900">
                {g.name}
                {g.isMain ? " (main)" : ""}
              </p>
              <p className="text-sm text-zinc-500">{g.type}</p>
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
        ))}
      </ul>
      <TripSoftPanel title="Create group">
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
