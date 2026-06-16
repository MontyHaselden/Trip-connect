"use client";

import { useState } from "react";

import { staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { newId } from "@/lib/host/wizard/types";

import { AsyncButton } from "../shared/AsyncButton";
import { TripDateInput } from "../shared/TripDateInput";
import { tripDatePickerContext } from "../shared/trip-date-picker";

export function AccommodationSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const datePicker = tripDatePickerContext(props.graph, props.selectedDate);
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
        <p className="text-sm text-zinc-600">Advanced / bulk edit — named stays with check-in/out.</p>
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
            <AsyncButton
              loading={props.saving}
              loadingLabel="Removing…"
              onClick={() =>
                void props.onDispatch([{ type: "removeStay", groupId: props.groupId, stayId: s.id }])
              }
              className="text-sm text-red-700 hover:underline"
            >
              Delete
            </AsyncButton>
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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel / property name" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City / region" className="rounded-lg border px-3 py-2 text-sm" />
          <TripDateInput
            value={checkIn}
            onChange={setCheckIn}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <TripDateInput
            value={checkOut}
            onChange={setCheckOut}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <AsyncButton
          onClick={() => void addStay()}
          loading={props.saving}
          loadingLabel="Adding…"
          className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Add stay
        </AsyncButton>
      </div>
    </div>
  );
}
