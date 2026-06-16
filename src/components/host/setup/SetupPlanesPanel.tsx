"use client";

import { useMemo, useState } from "react";

import { TransportLegForm } from "@/components/host/wizard/shared/TransportLegForm";
import {
  classifyImportedFlightChain,
  allPlaneLegsChronological,
  legTitleForBucket,
  mergeClassifiedLegsIntoState,
  removeLegsMatchingFlightNumbers,
  type FlightLegBucket,
} from "@/lib/host/setup/classify-flight-legs";
import { resolveFlightLookupForTrip } from "@/lib/host/setup/resolve-flight-lookup";
import {
  type FlightLookupResult,
} from "@/lib/host/wizard/flight-lookup-types";
import { buildPlaneLegChain } from "@/lib/host/wizard/flight-leg-chain";
import { normalizeFlightIata } from "@/lib/host/wizard/aerodatabox";
import { chainedTransportLeg, connectionLegHint } from "@/lib/host/wizard/leg-chain";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import type { TripSetupState } from "@/lib/host/setup/types";

type DraftFlightRow = {
  flight: string;
  departureDate: string;
};

const emptyDraftRow = (): DraftFlightRow => ({ flight: "", departureDate: "" });

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type TransportFlightFocus = {
  date: string;
  city?: string;
  half?: "left" | "right";
};

function formatLoadedFlight(row: FlightLookupResult): string {
  const date = row.travelDate?.trim();
  const dep = row.departureTime?.trim();
  const arr = row.arrivalTime?.trim();
  const time =
    dep && arr ? ` ${dep}–${arr}` : dep ? ` dep ${dep}` : arr ? ` arr ${arr}` : "";
  return date ? `${row.flightNumber} (${date}${time})` : row.flightNumber;
}

export function SetupPlanesPanel(props: {
  state: TripSetupState;
  activeGroupId: string;
  isMain: boolean;
  focus?: TransportFlightFocus | null;
  roster?: {
    groups: Array<{ id: string; name: string }>;
    participants: Array<{ id: string; fullName: string }>;
    rooms?: Array<{ id: string; roomName: string }>;
  };
  outboundLegs: TransportLegDraft[];
  returnLegs: TransportLegDraft[];
  intercityLegs: IntercityLegDraft[];
  onOutboundChange: (legs: TransportLegDraft[]) => void;
  onReturnChange: (legs: TransportLegDraft[]) => void;
  onIntercityChange: (legs: IntercityLegDraft[]) => void;
  onCommitClassified: (
    updates: Partial<Pick<TripSetupState, "outboundLegs" | "returnLegs" | "intercityLegs">>,
  ) => void;
  onFlightScheduled?: (travelDate: string) => void;
}) {
  const {
    state,
    activeGroupId,
    isMain,
    focus,
    roster,
    outboundLegs,
    returnLegs,
    intercityLegs,
    onOutboundChange,
    onReturnChange,
    onIntercityChange,
    onCommitClassified,
    onFlightScheduled,
  } = props;

  const [draftRows, setDraftRows] = useState<DraftFlightRow[]>([emptyDraftRow()]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const chronological = useMemo(() => {
    if (isMain) return allPlaneLegsChronological(state);
    return state.intercityLegs
      .filter(
        (leg) => leg.transportType === "plane" && leg.originGroupId === activeGroupId,
      )
      .map((leg) => ({ leg, bucket: "intercity" as FlightLegBucket }))
      .sort((a, b) =>
        `${a.leg.travelDate}T${a.leg.departureTime ?? ""}`.localeCompare(
          `${b.leg.travelDate}T${b.leg.departureTime ?? ""}`,
        ),
      );
  }, [state, isMain, activeGroupId]);

  function parsedDraftRows(): Array<{ flightNumber: string; departureDate: string }> {
    return draftRows
      .map((row) => ({
        flightNumber: normalizeFlightIata(row.flight.trim()),
        departureDate: row.departureDate.trim(),
      }))
      .filter((row) => row.flightNumber.length >= 2);
  }

  function updateDraftFlight(index: number, value: string) {
    setDraftRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, flight: value } : row)),
    );
  }

  function updateDraftDepartureDate(index: number, value: string) {
    setDraftRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, departureDate: value } : row)),
    );
  }

  function addDraftRow() {
    setDraftRows((rows) => [...rows, emptyDraftRow()]);
  }

  function removeDraftRow(index: number) {
    setDraftRows((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length ? next : [emptyDraftRow()];
    });
  }

  async function lookupFlightChain(
    rows: Array<{ flightNumber: string; departureDate: string }>,
  ): Promise<{ lookups: FlightLookupResult[]; failures: string[] }> {
    const lookups: FlightLookupResult[] = [];
    const failures: string[] = [];

    for (const row of rows) {
      if (!ISO_DATE.test(row.departureDate)) {
        failures.push(`${row.flightNumber}: enter departure date`);
        continue;
      }
      const body = await resolveFlightLookupForTrip(row.flightNumber, row.departureDate);
      if (!body.flight) {
        failures.push(`${row.flightNumber}: ${body.error ?? "not found"}`);
        continue;
      }
      lookups.push(body.flight);
    }

    return { lookups, failures };
  }

  async function importFlights() {
    const rows = parsedDraftRows();
    if (!rows.length) {
      setImportError("Enter at least one flight number.");
      setImportMessage(null);
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportMessage(null);

    try {
      const numbers = rows.map((row) => row.flightNumber);
      const stripped = removeLegsMatchingFlightNumbers(state, numbers);
      const { lookups, failures } = await lookupFlightChain(rows);

      if (!lookups.length) {
        setImportError(failures.join(" · ") || "No flights found.");
        return;
      }

      const seed = {
        startDate: stripped.basics.startDate,
        endDate: stripped.basics.endDate,
        departureCity: stripped.basics.departureCity,
        returnCity: stripped.basics.returnCity,
        defaultAirport: stripped.basics.defaultDepartureAirport,
      };

      const imported = buildPlaneLegChain(lookups, {
        placement: "outbound",
        seed,
      }) as TransportLegDraft[];

      const classified = classifyImportedFlightChain(imported, stripped);
      const merged = mergeClassifiedLegsIntoState(stripped, classified);
      onCommitClassified(merged);

      setDraftRows([emptyDraftRow()]);
      const loaded = lookups.map(formatLoadedFlight).join(", ");
      const failNote = failures.length ? ` Could not load: ${failures.join("; ")}` : "";
      setImportMessage(`Loaded ${loaded}.${failNote}`);
      if (failures.length) setImportError(failures.join(" · "));
      const firstDate = lookups[0]?.travelDate?.trim();
      if (firstDate) onFlightScheduled?.(firstDate);
    } catch {
      setImportError("Flight import failed. Try again.");
    } finally {
      setImporting(false);
    }
  }

  function updateLeg(bucket: FlightLegBucket, legId: string, next: TransportLegDraft) {
    if (bucket === "outbound") {
      onOutboundChange(outboundLegs.map((row) => (row.id === legId ? next : row)));
      return;
    }
    if (bucket === "return") {
      onReturnChange(returnLegs.map((row) => (row.id === legId ? next : row)));
      return;
    }
    onIntercityChange(
      intercityLegs.map((row) => {
        if (row.id !== legId) return row;
        const prior = row as IntercityLegDraft;
        return {
          ...next,
          intercityFromCity: prior.intercityFromCity,
          intercityToCity: prior.intercityToCity,
          originGroupId: prior.originGroupId,
          legKind: prior.legKind,
          surfaceOnly: prior.surfaceOnly,
        } satisfies IntercityLegDraft;
      }),
    );
  }

  function removeLeg(bucket: FlightLegBucket, legId: string) {
    if (bucket === "outbound") {
      onOutboundChange(outboundLegs.filter((row) => row.id !== legId));
      return;
    }
    if (bucket === "return") {
      onReturnChange(returnLegs.filter((row) => row.id !== legId));
      return;
    }
    onIntercityChange(intercityLegs.filter((row) => row.id !== legId));
  }

  function addBlankLeg() {
    const previous = chronological[chronological.length - 1]?.leg;
    const blank = chainedTransportLeg(previous);
    const classified = classifyImportedFlightChain([blank], state);
    onCommitClassified(mergeClassifiedLegsIntoState(state, classified));
  }

  const focusNote =
    focus?.date && focus.city
      ? `Focused on ${focus.city} · ${focus.date}${focus.half ? ` (${focus.half} half)` : ""}. Add or edit a flight below.`
      : focus?.date
        ? `Focused on ${focus.date}. Add or edit a flight below.`
        : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Planes</p>
        <h2 className="text-xl font-semibold text-zinc-900">Flights</h2>
        <p className="text-sm text-zinc-600">
          Enter the flight number and departure date from your ticket. We load that day&apos;s
          schedule from the airline and place it on the calendar at the exact times returned.
        </p>
      </header>

      {focusNote ? (
        <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          {focusNote}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-medium text-zinc-900">Add flights</p>
        <div className="space-y-2">
          {draftRows.map((row, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                id={index === 0 ? "flight-number-0" : undefined}
                type="text"
                value={row.flight}
                onChange={(e) => updateDraftFlight(index, e.target.value)}
                placeholder={index === 0 ? "e.g. JQ172" : "Next flight"}
                className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100"
              />
              <input
                type="date"
                required
                value={row.departureDate}
                onChange={(e) => updateDraftDepartureDate(index, e.target.value)}
                className="h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100 sm:w-40"
                aria-label={`Departure date for flight ${index + 1}`}
              />
              {draftRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeDraftRow(index)}
                  className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                  aria-label={`Remove flight ${index + 1}`}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addDraftRow}
          className="text-xs font-medium text-sky-800 hover:underline"
        >
          + Add flight
        </button>
        <div className="pt-1">
          <button
            type="button"
            disabled={importing}
            onClick={() => void importFlights()}
            className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            {importing ? "Looking up…" : "Look up flights"}
          </button>
        </div>
        {importMessage ? <p className="text-sm text-emerald-800">{importMessage}</p> : null}
        {importError ? <p className="text-sm text-red-700">{importError}</p> : null}
      </section>

      {!isMain ? (
        <p className="text-sm text-zinc-600">
          Main Group outbound and return flights are inherited. Add group plane legs below if this
          group flies separately.
        </p>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Your flights</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            In trip order — the calendar shows these at their scheduled times.
          </p>
        </div>
        {chronological.length === 0 ? (
          <p className="text-sm text-zinc-500">No flights yet. Look up a flight number above.</p>
        ) : (
          chronological.map(({ leg, bucket }, index) => {
            const prev = chronological[index - 1]?.leg;
            const highlighted =
              focus?.date &&
              (leg.travelDate === focus.date || leg.arrivalDate === focus.date);
            return (
              <div
                key={leg.id}
                className={highlighted ? "rounded-xl ring-2 ring-indigo-300 ring-offset-2" : ""}
              >
                <TransportLegForm
                  leg={leg}
                  legTitle={legTitleForBucket(bucket, index, leg)}
                  legHint={connectionLegHint(prev)}
                  tripLookup={{ state }}
                  showRemove
                  countryNames={state.basics.destinationCountries}
                  roster={roster}
                  onRemove={() => removeLeg(bucket, leg.id)}
                  onChange={(next) => updateLeg(bucket, leg.id, next)}
                />
              </div>
            );
          })
        )}
        <button
          type="button"
          onClick={addBlankLeg}
          className="text-xs font-medium text-sky-800 hover:underline"
        >
          + Add plane leg
        </button>
      </section>
    </div>
  );
}
