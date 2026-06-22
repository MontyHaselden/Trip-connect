"use client";

import { useState } from "react";

import {
  homestayPeriodStays,
  nonHomestayStays,
} from "@/lib/host/accommodation/homestay-helpers";
import { PICKABLE_STAY_TYPES, stayTypeLabel } from "@/lib/host/accommodation/stay-type-labels";
import type { StayType } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import { staysForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph, RosterSummary } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

import { HomestaysPanel } from "./HomestaysPanel";
import { TripDateInput } from "../shared/TripDateInput";
import { TripInput, tripFieldClass } from "../shared/TripInput";
import { TripPrimaryButton } from "../shared/TripPrimaryButton";
import { TripSectionShell, TripSoftPanel } from "../shared/TripSectionShell";
import { tripDatePickerContext } from "../shared/trip-date-picker";

const ADD_STAY_TYPES = PICKABLE_STAY_TYPES.filter((t) => t !== "homestay");

export function AccommodationSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  tripId: string;
  rosterSummary?: RosterSummary;
  selectedDate?: string | null;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const datePicker = tripDatePickerContext(props.graph, props.selectedDate);
  const allStays = staysForGroup(props.graph, props.groupId);
  const hotelStays = nonHomestayStays(allStays);
  const homestayPeriods = homestayPeriodStays(allStays);

  const [stayType, setStayType] = useState<StayType>("hotel");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adding, setAdding] = useState(false);

  const [homestayLabel, setHomestayLabel] = useState("");
  const [homestayCity, setHomestayCity] = useState("");
  const [homestayCheckIn, setHomestayCheckIn] = useState("");
  const [homestayCheckOut, setHomestayCheckOut] = useState("");
  const [addingHomestay, setAddingHomestay] = useState(false);

  function addHotelStay() {
    if (!name.trim() || !checkIn || !checkOut) return;

    setAdding(true);
    void props
      .onDispatch([
        {
          type: "addStay",
          groupId: props.groupId,
          stay: {
            id: newId(),
            cityLabel: city.trim() || name.trim(),
            stayType,
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
      ])
      .finally(() => setAdding(false));

    setName("");
    setCity("");
    setCheckIn("");
    setCheckOut("");
  }

  function addHomestayPeriod() {
    if (!homestayCheckIn || !homestayCheckOut) return;
    const label =
      homestayLabel.trim() ||
      `Homestays${homestayCity.trim() ? ` · ${homestayCity.trim()}` : ""}`;

    setAddingHomestay(true);
    void props
      .onDispatch([
        {
          type: "addStay",
          groupId: props.groupId,
          stay: {
            id: newId(),
            cityLabel: homestayCity.trim() || label,
            stayType: "homestay",
            name: label,
            url: null,
            address: null,
            phone: null,
            checkInDate: homestayCheckIn,
            checkOutDate: homestayCheckOut,
            notes: null,
            isHomestayGroup: true,
            multipleInCity: true,
          },
        },
      ])
      .finally(() => setAddingHomestay(false));

    setHomestayLabel("");
    setHomestayCity("");
    setHomestayCheckIn("");
    setHomestayCheckOut("");
  }

  function removeStay(stayId: string) {
    void props.onDispatch([{ type: "removeStay", groupId: props.groupId, stayId }]);
  }

  const roster = props.rosterSummary ?? { participants: [], groups: [], rooms: [] };

  return (
    <TripSectionShell
      eyebrow="Advanced"
      title="Accommodation"
      description="Hotels and hostels for the whole group, or a homestay period where each student stays with a host family."
    >
      <TripSoftPanel title="Hotels & group stays">
        <ul className="mb-4 space-y-2">
          {hotelStays.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-zinc-900">{s.name || "Unnamed stay"}</p>
                <p className="text-sm text-zinc-500">
                  {s.stayType.replace(/_/g, " ")} · {s.cityLabel} · {s.checkInDate} → {s.checkOutDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeStay(s.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
          {!hotelStays.length ? (
            <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
              No hotels or group stays yet.
            </li>
          ) : null}
        </ul>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Type</span>
            <select
              value={stayType === "homestay" ? "hotel" : stayType}
              onChange={(e) => setStayType(e.target.value as StayType)}
              className={tripFieldClass}
            >
              {ADD_STAY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {stayTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <TripInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hotel / property name"
          />
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
        <TripPrimaryButton
          onClick={addHotelStay}
          disabled={adding || !name.trim() || !checkIn || !checkOut}
          className="mt-4"
        >
          {adding ? "Adding…" : "Add stay"}
        </TripPrimaryButton>
      </TripSoftPanel>

      <TripSoftPanel title="Homestay period" className="mt-6">
        <p className="mb-4 text-sm text-zinc-600">
          Add a homestay block for dates when students stay with local families. Then add each host
          family below with the students who stay there.
        </p>
        <ul className="mb-4 space-y-2">
          {homestayPeriods.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
            >
              <div>
                <p className="font-medium text-zinc-900">{s.name || "Homestays"}</p>
                <p className="text-sm text-zinc-500">
                  {s.cityLabel} · {s.checkInDate} → {s.checkOutDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeStay(s.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </li>
          ))}
          {!homestayPeriods.length ? (
            <li className="rounded-2xl bg-zinc-50/80 px-4 py-6 text-center text-sm text-zinc-500">
              No homestay period yet — add one to assign host families.
            </li>
          ) : null}
        </ul>

        <div className="grid gap-2 sm:grid-cols-2">
          <TripInput
            value={homestayLabel}
            onChange={(e) => setHomestayLabel(e.target.value)}
            placeholder="Label (optional, e.g. Homestays in Kyoto)"
            className="sm:col-span-2"
          />
          <TripInput
            value={homestayCity}
            onChange={(e) => setHomestayCity(e.target.value)}
            placeholder="City / region"
          />
          <div />
          <TripDateInput
            value={homestayCheckIn}
            onChange={setHomestayCheckIn}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
          <TripDateInput
            value={homestayCheckOut}
            onChange={setHomestayCheckOut}
            tripStart={datePicker.tripStart}
            tripEnd={datePicker.tripEnd}
            anchorDate={datePicker.anchorDate}
            className={tripFieldClass}
          />
        </div>
        <TripPrimaryButton
          onClick={addHomestayPeriod}
          disabled={addingHomestay || !homestayCheckIn || !homestayCheckOut}
          className="mt-4"
        >
          {addingHomestay ? "Adding…" : "Add homestay period"}
        </TripPrimaryButton>
      </TripSoftPanel>

      <div className="mt-6">
        <HomestaysPanel
          tripId={props.tripId}
          groupId={props.groupId}
          graph={props.graph}
          stays={allStays}
          roster={roster}
          selectedDate={props.selectedDate}
          saving={props.saving}
          onDispatch={props.onDispatch}
        />
      </div>
    </TripSectionShell>
  );
}
