"use client";

import { useState } from "react";

import { legsForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { newId } from "@/lib/host/wizard/types";

export function TransportSection(props: {
  graph: TripEntityGraph;
  groupId: string;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
}) {
  const legs = legsForGroup(props.graph, props.groupId);
  const all = [...legs.outbound, ...legs.return, ...legs.intercity];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [depart, setDepart] = useState("");
  const [arrive, setArrive] = useState("");
  const [flight, setFlight] = useState("");

  async function addLeg() {
    if (!date || !from.trim() || !to.trim()) return;
    await props.onDispatch([
      {
        type: "addTransportLeg",
        groupId: props.groupId,
        bucket: "intercity",
        leg: {
          id: newId(),
          transportType: "plane",
          bookingStatus: "not_booked",
          travelDate: date,
          arrivalDate: date,
          departureTime: depart || null,
          arrivalTime: arrive || null,
          fromCity: from.trim(),
          toCity: to.trim(),
          fromStation: from.trim(),
          toStation: to.trim(),
          operator: null,
          referenceNumber: null,
          flightNumber: flight.trim() || null,
          notes: null,
          intercityFromCity: from.trim(),
          intercityToCity: to.trim(),
          originGroupId: props.groupId,
        },
      },
    ]);
    setFrom("");
    setTo("");
    setDate("");
    setDepart("");
    setArrive("");
    setFlight("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Transport</h2>
        <p className="text-sm text-zinc-600">Legs save to trip_transport_legs.</p>
      </div>
      <ul className="space-y-2">
        {all.map((leg) => (
          <li key={leg.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
            <div>
              <p className="font-medium">
                {leg.fromCity || "?"} → {leg.toCity || "?"}
              </p>
              <p className="text-sm text-zinc-600">
                {leg.travelDate}
                {leg.departureTime ? ` · dep ${leg.departureTime}` : " · time TBC"}
                {leg.flightNumber ? ` · ${leg.flightNumber}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                props.onDispatch([
                  {
                    type: "removeTransportLeg",
                    groupId: props.groupId,
                    bucket: "intercity",
                    legId: leg.id,
                  },
                ])
              }
              className="text-sm text-red-700 hover:underline"
            >
              Delete
            </button>
          </li>
        ))}
        {!all.length ? (
          <li className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
            No transport legs yet.
          </li>
        ) : null}
      </ul>
      <div className="rounded-xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold">Add flight / leg</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" className="rounded-lg border px-3 py-2 text-sm" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" />
          <input value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="Flight number (optional)" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={depart} onChange={(e) => setDepart(e.target.value)} placeholder="Departure HH:MM" className="rounded-lg border px-3 py-2 text-sm" />
          <input value={arrive} onChange={(e) => setArrive(e.target.value)} placeholder="Arrival HH:MM" className="rounded-lg border px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={() => void addLeg()} className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Add leg
        </button>
      </div>
    </div>
  );
}
