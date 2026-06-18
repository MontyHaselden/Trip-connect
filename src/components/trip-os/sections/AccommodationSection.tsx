"use client";

import { useState } from "react";

import { staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { newId } from "@/lib/host/wizard/types";

import { AsyncButton } from "../shared/AsyncButton";
import { TripDateInput } from "../shared/TripDateInput";
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
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
  const [removingStayId, setRemovingStayId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function addStay() {
    if (!name.trim() || !checkIn || !checkOut) return;
    setAdding(true);
    try {
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
    } finally {
      setAdding(false);
    }
  }

  async function removeStay(stayId: string) {
    setRemovingStayId(stayId);
    try {
      await props.onDispatch([{ type: "removeStay", groupId: props.groupId, stayId }]);
    } finally {
      setRemovingStayId(null);
    }
  }

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Accommodation"
      description="Named stays with check-in and check-out dates."
    >
      <ul className="space-y-2">
        {stays.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div>
              <p className="font-medium text-zinc-900">{s.name || "Unnamed stay"}</p>
              <p className="text-sm text-zinc-500">
                {s.cityLabel} · {s.checkInDate} → {s.checkOutDate}
              </p>
            </div>
            <AsyncButton
              loading={removingStayId === s.id}
              loadingLabel="Removing…"
              onClick={() => void removeStay(s.id)}
              disabled={removingStayId !== null && removingStayId !== s.id}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Delete
            </AsyncButton>
          </li>
        ))}
        {!stays.length ? (
          <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
            No stays yet.
          </li>
        ) : null}
      </ul>
      <TripSoftPanel title="Add stay">
        <div className="grid gap-2 sm:grid-cols-2">
          <TripInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel / property name" />
          <TripInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="City / region" />
          <TripDateInput
            value={checkIn}
            onChange={setCheckIn}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
          <TripDateInput
            value={checkOut}
            onChange={setCheckOut}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
        </div>
        <TripPrimaryButton onClick={() => void addStay()} disabled={adding || removingStayId !== null} className="mt-4">
          {adding ? "Adding…" : "Add stay"}
        </TripPrimaryButton>
      </TripSoftPanel>
    </TripSectionShell>
  );
}
