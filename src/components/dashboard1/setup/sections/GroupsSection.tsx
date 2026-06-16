"use client";

import { useState } from "react";

import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

export function GroupsSection(props: {
  graph: TripEntityGraph;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("split_travel");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Groups</h2>
        <p className="text-sm text-zinc-600">Main group is base; extra groups inherit main projection.</p>
      </div>
      <ul className="space-y-2">
        {props.graph.groups.map((g) => (
          <li key={g.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
            <div>
              <p className="font-medium">
                {g.name}
                {g.isMain ? " (main)" : ""}
              </p>
              <p className="text-sm text-zinc-600">{g.type}</p>
            </div>
            {!g.isMain ? (
              <button
                type="button"
                onClick={() => props.onDispatch([{ type: "deleteGroup", groupId: g.id }])}
                className="text-sm text-red-700 hover:underline"
              >
                Delete
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Create group</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" className="rounded-lg border px-3 py-2 text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
            <option value="split_travel">Split travel</option>
            <option value="activity">Activity</option>
            <option value="accommodation">Accommodation</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return;
            void props.onDispatch([
              { type: "createGroup", name: name.trim(), groupType: type },
            ]);
            setName("");
          }}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Create group
        </button>
      </div>
    </div>
  );
}
