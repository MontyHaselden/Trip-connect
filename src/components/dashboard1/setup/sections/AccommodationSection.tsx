"use client";

import { useState } from "react";

import { staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { newId } from "@/lib/host/wizard/types";

export function AccommodationSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const stays = staysForGroup(props.graph, props.groupId);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  async function addStay() {
    if (!name.trim() || !checkIn || !checkOut) return;
    await props.onDispatch([
      {
        type: "addStay",
        groupId: props.groupId,
        stay: {
          id: newId(),
          cityLabel: city.trim() || name.trim(),
          stayType: "hotel",
          name: name.trim(),
          url: null,
          address: null,
          phone: null,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      },
    ]);
    setName("");
    setCity("");
    setCheckIn("");
    setCheckOut("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Accommodation</h2>
        <p className="text-sm text-zinc-600">Stays save to trip_accommodation_stays via commands.</p>
      </div>
      <ul className="space-y-2">
        {stays.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
            <div>
              <p className="font-medium">{s.name || "Unnamed stay"}</p>
              <p className="text-sm text-zinc-600">
                {s.cityLabel} · {s.checkInDate} → {s.checkOutDate}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                props.onDispatch([{ type: "removeStay", groupId: props.groupId, stayId: s.id }])
              }
              className="text-sm text-red-700 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
        {!stays.length ? (
          <li className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            No stays yet.
          </li>
        ) : null}
      </ul>
      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Add stay</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hotel / property name"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City / region"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void addStay()}
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add stay
        </button>
      </div>
    </div>
  );
}
