"use client";

import { useState } from "react";

import { AirportPicker } from "@/components/geo/AirportPicker";
import { resolveFlightLookupForTrip } from "@/lib/host/setup/resolve-flight-lookup";
import {
  applyFlightLookupToLeg,
  type FlightLookupResult,
} from "@/lib/host/wizard/lookup-flight";
import { lookupHintAfterLeg } from "@/lib/host/wizard/flight-leg-chain";
import { syncConsecutiveFlightLegs } from "@/lib/host/wizard/leg-chain";
import { newId, type IntercityLegDraft, type TransportLegDraft } from "@/lib/host/wizard/types";

import { AsyncButton } from "./AsyncButton";
import { TripDateInput } from "./TripDateInput";

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

type LegRow = {
  id: string;
  flight: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
};

function emptyRow(): LegRow {
  return {
    id: newId(),
    flight: "",
    from: "",
    to: "",
    depart: "",
    arrive: "",
  };
}

function emptyLeg(date: string, groupId: string): IntercityLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "placeholder",
    travelDate: date,
    arrivalDate: date,
    departureTime: null,
    arrivalTime: null,
    fromCity: "",
    toCity: "",
    fromStation: "",
    toStation: "",
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    intercityFromCity: "",
    intercityToCity: "",
    originGroupId: groupId,
  };
}

function finalizeLeg(
  base: IntercityLegDraft,
  manual: {
    from: string;
    to: string;
    depart: string;
    arrive: string;
    flight: string;
    date: string;
  },
  lookup?: FlightLookupResult,
): IntercityLegDraft {
  let leg = { ...base, travelDate: manual.date, flightNumber: manual.flight.trim() || null };
  if (lookup) {
    leg = applyFlightLookupToLeg(leg, lookup) as IntercityLegDraft;
    leg.intercityFromCity = leg.fromCity;
    leg.intercityToCity = leg.toCity;
    return leg;
  }

  const from = manual.from.trim();
  const to = manual.to.trim();
  const hasManualRoute = Boolean(from || to);
  return {
    ...leg,
    fromCity: from,
    toCity: to,
    fromStation: from,
    toStation: to,
    intercityFromCity: from,
    intercityToCity: to,
    departureTime: manual.depart.trim() || null,
    arrivalTime: manual.arrive.trim() || null,
    bookingStatus: hasManualRoute ? "not_booked" : "placeholder",
  };
}

function hasManualRouteFields(row: LegRow): boolean {
  return Boolean(row.from.trim() || row.to.trim() || row.depart.trim() || row.arrive.trim());
}

function LegRowFields(props: {
  index: number;
  row: LegRow;
  busy: boolean;
  canRemove: boolean;
  forcePlaceholderOpen?: boolean;
  onChange: (patch: Partial<LegRow>) => void;
  onRemove: () => void;
}) {
  const { index, row, busy, canRemove } = props;
  const label = index === 0 ? "Flight 1" : `Connection ${index + 1}`;
  const [placeholderOpen, setPlaceholderOpen] = useState(() => hasManualRouteFields(row));

  const showPlaceholderFields =
    placeholderOpen || Boolean(props.forcePlaceholderOpen) || hasManualRouteFields(row);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        {canRemove ? (
          <button
            type="button"
            onClick={props.onRemove}
            disabled={busy}
            className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-zinc-700">Flight number</span>
        <input
          value={row.flight}
          onChange={(e) => props.onChange({ flight: e.target.value })}
          placeholder="e.g. JQ172"
          className={inputClass}
          disabled={busy}
        />
      </label>
      {showPlaceholderFields ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">Manual route when lookup is unavailable</p>
            {!hasManualRouteFields(row) ? (
              <button
                type="button"
                onClick={() => setPlaceholderOpen(false)}
                disabled={busy}
                className="shrink-0 text-xs font-medium text-zinc-600 hover:underline disabled:opacity-50"
              >
                Hide
              </button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <AirportPicker
              value={row.from}
              onChange={(from) => props.onChange({ from })}
              placeholder="From airport (manual)"
              inputClassName={inputClass}
            />
            <AirportPicker
              value={row.to}
              onChange={(to) => props.onChange({ to })}
              placeholder="To airport (manual)"
              inputClassName={inputClass}
            />
            <input
              value={row.depart}
              onChange={(e) => props.onChange({ depart: e.target.value })}
              placeholder="Departure time (manual)"
              className={inputClass}
              disabled={busy}
            />
            <input
              value={row.arrive}
              onChange={(e) => props.onChange({ arrive: e.target.value })}
              placeholder="Arrival time (manual)"
              className={inputClass}
              disabled={busy}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaceholderOpen(true)}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
        >
          Placeholder flights
        </button>
      )}
    </div>
  );
}

export function FlightLegQuickForm(props: {
  groupId: string;
  defaultDate?: string;
  anchorDate?: string;
  saving?: boolean;
  onSubmit: (legs: IntercityLegDraft[]) => Promise<boolean>;
}) {
  const [date, setDate] = useState(props.defaultDate ?? "");
  const [rows, setRows] = useState<LegRow[]>([emptyRow()]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [showPlaceholderHint, setShowPlaceholderHint] = useState(false);

  const busy = Boolean(props.saving || lookupLoading);
  const filledRows = rows.filter((row) => row.flight.trim());
  const submitLabel =
    filledRows.length > 1 ? `Add ${filledRows.length} flights` : "Add flight";

  function updateRow(id: string, patch: Partial<LegRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setLookupError(null);
    setLookupMessage(null);
    setShowPlaceholderHint(false);
  }

  function addConnectionRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  async function buildLegs(): Promise<IntercityLegDraft[]> {
    if (!date.trim()) return [];
    const activeRows = rows.filter((row) => row.flight.trim());
    if (!activeRows.length) return [];

    setLookupLoading(true);
    setLookupError(null);
    setLookupMessage(null);

    const lookupErrors: string[] = [];
    let lookupHits = 0;

    try {
      const built: TransportLegDraft[] = [];
      for (const row of activeRows) {
        const lookupDate =
          built.length > 0 ? lookupHintAfterLeg(built[built.length - 1]!) ?? date : date;
        const manual = {
          from: row.from,
          to: row.to,
          depart: row.depart,
          arrive: row.arrive,
          flight: row.flight,
          date: lookupDate,
        };
        const base = emptyLeg(lookupDate, props.groupId);
        const { flight: lookup, error } = await resolveFlightLookupForTrip(row.flight, lookupDate);
        if (lookup) lookupHits += 1;
        if (error && !row.from.trim() && !row.to.trim()) {
          lookupErrors.push(`${row.flight.trim()}: ${error}`);
        }
        built.push(finalizeLeg(base, manual, lookup));
      }

      const legs: IntercityLegDraft[] = syncConsecutiveFlightLegs(built).map((leg, index) => ({
        ...leg,
        intercityFromCity: leg.fromCity,
        intercityToCity: leg.toCity,
        originGroupId: props.groupId,
        legKind: index === 0 ? undefined : "connection",
      }));

      if (lookupHits === activeRows.length) {
        setLookupMessage(
          activeRows.length > 1
            ? `Found all ${lookupHits} flights — airports and times filled in.`
            : "Found flight — airports and times filled in.",
        );
      } else if (lookupHits > 0) {
        setLookupMessage(`Found ${lookupHits} of ${activeRows.length} flights.`);
      }
      if (lookupErrors.length) {
        setShowPlaceholderHint(true);
        setLookupError(
          `${lookupErrors.join(" ")} Open Placeholder flights to enter route details, or save as placeholder.`,
        );
      }

      return legs;
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleAdd() {
    const legs = await buildLegs();
    if (!legs.length) return;
    const ok = await props.onSubmit(legs);
    if (ok) {
      setRows([emptyRow()]);
      setLookupMessage(null);
      setLookupError(null);
      setShowPlaceholderHint(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-zinc-700">Departure date</span>
        <TripDateInput
          value={date}
          onChange={setDate}
          anchorDate={props.defaultDate?.trim() || props.anchorDate}
          restrictToTripBounds={false}
          className={inputClass}
          disabled={busy}
        />
        {rows.length > 1 ? (
          <p className="mt-1 text-xs text-zinc-500">
            First leg uses this date; later connections look up from the previous leg&apos;s arrival
            day (e.g. overnight BKK → MEL, then MEL → home next morning).
          </p>
        ) : null}
      </label>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <LegRowFields
            key={row.id}
            index={index}
            row={row}
            busy={busy}
            canRemove={rows.length > 1}
            forcePlaceholderOpen={showPlaceholderHint}
            onChange={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addConnectionRow}
        disabled={busy}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50"
      >
        <span className="text-base leading-none">+</span>
        Add connection leg
      </button>

      {lookupError ? <p className="text-xs text-amber-800">{lookupError}</p> : null}
      {lookupMessage ? <p className="text-xs text-emerald-700">{lookupMessage}</p> : null}

      <AsyncButton
        onClick={() => void handleAdd()}
        loading={busy}
        loadingLabel={lookupLoading ? "Looking up flights…" : "Adding…"}
        disabled={!date.trim() || !filledRows.length}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        {submitLabel}
      </AsyncButton>
    </div>
  );
}
