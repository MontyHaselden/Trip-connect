"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AirportPicker } from "@/components/geo/AirportPicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import { resolveFlightLookupForTrip } from "@/lib/host/setup/resolve-flight-lookup";
import type { TripSetupState } from "@/lib/host/setup/types";
import {
  applyFlightLookupToLeg,
  type FlightLookupResult,
} from "@/lib/host/wizard/lookup-flight";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { BookingStatus, TransportLegDraft, TransportType } from "@/lib/host/wizard/types";
import { TRANSPORT_TYPES } from "@/lib/host/wizard/types";
import {
  VisibilityPicker,
  type VisibilityPickerValue,
} from "@/components/host/shared/VisibilityPicker";

function withSuggestedPlaneArrival(leg: TransportLegDraft): TransportLegDraft {
  if (leg.transportType !== "plane" || leg.arrivalDate?.trim()) return leg;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leg.travelDate?.trim() ?? "")) return leg;
  const inferred = arrivalDate(leg);
  if (inferred === leg.travelDate) return leg;
  return { ...leg, arrivalDate: inferred };
}

const TRANSPORT_LABELS: Record<TransportType, string> = {
  unsure: "Unsure",
  plane: "Plane",
  train: "Train",
  bus: "Bus",
  coach: "Coach",
  ferry: "Ferry",
  car: "Car",
  taxi: "Taxi / shuttle",
  walking: "Walking",
  other: "Other",
};

const inputClass =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-medium text-zinc-600">{children}</span>
  );
}

export function TransportLegForm({
  leg,
  onChange,
  onRemove,
  showRemove,
  countryNames = [],
  legTitle,
  legHint,
  roster,
  tripLookup,
  chainFromLeg,
  onFlightResolved,
}: {
  leg: TransportLegDraft;
  onChange: (leg: TransportLegDraft) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  countryNames?: string[];
  legTitle: string;
  legHint?: string;
  roster?: {
    groups: Array<{ id: string; name: string }>;
    participants: Array<{ id: string; fullName: string }>;
    rooms?: Array<{ id: string; roomName: string }>;
  };
  /** Trip-aware lookup — ignores calendar selection dates. */
  tripLookup?: {
    state: TripSetupState;
    ignoreDates?: string[];
  };
  chainFromLeg?: TransportLegDraft;
  onFlightResolved?: (result: FlightLookupResult) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [fromQuery, setFromQuery] = useState(leg.fromCity);
  const [toQuery, setToQuery] = useState(leg.toCity);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const isPlane = leg.transportType === "plane";
  const showBookingRef = leg.bookingStatus === "booked" && !isPlane;
  const bookingValue =
    leg.bookingStatus === "not_booked" ? "placeholder" : leg.bookingStatus;

  const resolvedArrivalDate = leg.arrivalDate ?? arrivalDate(leg);

  useEffect(() => {
    setFromQuery(leg.fromCity);
    setToQuery(leg.toCity);
  }, [leg.id, leg.fromCity, leg.toCity]);

  function commitFromCity(fromCity: string) {
    onChange(withSuggestedPlaneArrival({ ...leg, fromCity }));
  }

  function commitToCity(toCity: string) {
    onChange(withSuggestedPlaneArrival({ ...leg, toCity }));
  }

  function setVisibility(value: VisibilityPickerValue) {
    onChange({
      ...leg,
      visibilityMode: value.visibilityMode,
      targets: value.targets,
    });
  }

  async function runFlightLookup() {
    const flight = leg.flightNumber?.trim();
    if (!flight) {
      setLookupError("Enter a flight number first.");
      setLookupMessage(null);
      return;
    }

    const departureDate = leg.travelDate?.trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      setLookupError("Set the departure date on this leg, then look up the flight.");
      setLookupMessage(null);
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setLookupMessage(null);

    try {
      let body: { flight?: FlightLookupResult; error?: string };

      if (tripLookup) {
        body = await resolveFlightLookupForTrip(flight, departureDate);
      } else {
        const params = new URLSearchParams({ flight, date: departureDate });
        const res = await fetch(`/api/geo/flight-lookup?${params.toString()}`);
        body = (await res.json()) as { flight?: FlightLookupResult; error?: string };
        if (!res.ok || !body.flight) {
          setLookupError(body.error ?? "Flight not found.");
          return;
        }
      }

      if (!body.flight) {
        setLookupError(body.error ?? "Flight not found.");
        return;
      }

      onChange(applyFlightLookupToLeg(leg, body.flight));
      onFlightResolved?.(body.flight);
      setFromQuery(body.flight.departureAirport ?? leg.fromCity);
      setToQuery(body.flight.arrivalAirport ?? leg.toCity);
      const dep = body.flight.departureTime?.trim();
      const arr = body.flight.arrivalTime?.trim();
      const scheduleLabel = body.flight.travelDate
        ? [
            body.flight.travelDate,
            dep || arr ? `${dep ?? "?"}–${arr ?? "?"}` : null,
          ]
            .filter(Boolean)
            .join(" ")
        : null;
      setLookupMessage(
        scheduleLabel
          ? `Loaded ${body.flight.flightNumber} (${scheduleLabel}).`
          : `Loaded airports for ${body.flight.flightNumber}.`,
      );
    } catch {
      setLookupError("Flight lookup failed. Try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="overflow-visible rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{legTitle}</p>
          {legHint ? <p className="mt-0.5 text-xs text-indigo-700">{legHint}</p> : null}
        </div>
        {showRemove && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-xs font-medium text-red-600 hover:underline"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="space-y-5 p-4">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Route</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <label className="block min-w-0">
              <FieldLabel>{isPlane ? "From airport" : "From"}</FieldLabel>
              {isPlane ? (
                <AirportPicker
                  value={fromQuery}
                  onChange={setFromQuery}
                  onSelectOption={commitFromCity}
                  onBlur={() => {
                    if (fromQuery.trim() !== leg.fromCity.trim()) commitFromCity(fromQuery.trim());
                  }}
                  inputClassName={inputClass}
                />
              ) : (
                <PlacePicker
                  value={fromQuery}
                  onChange={setFromQuery}
                  onSelectOption={commitFromCity}
                  onBlur={() => {
                    if (fromQuery.trim() !== leg.fromCity.trim()) commitFromCity(fromQuery.trim());
                  }}
                  countryNames={countryNames}
                  inputClassName={inputClass}
                />
              )}
            </label>
            <span
              className="hidden pb-2.5 text-center text-base font-medium text-zinc-300 sm:block"
              aria-hidden
            >
              →
            </span>
            <label className="block min-w-0">
              <FieldLabel>{isPlane ? "To airport" : "To"}</FieldLabel>
              {isPlane ? (
                <AirportPicker
                  value={toQuery}
                  onChange={setToQuery}
                  onSelectOption={commitToCity}
                  onBlur={() => {
                    if (toQuery.trim() !== leg.toCity.trim()) commitToCity(toQuery.trim());
                  }}
                  inputClassName={inputClass}
                />
              ) : (
                <PlacePicker
                  value={toQuery}
                  onChange={setToQuery}
                  onSelectOption={commitToCity}
                  onBlur={() => {
                    if (toQuery.trim() !== leg.toCity.trim()) commitToCity(toQuery.trim());
                  }}
                  countryNames={countryNames}
                  inputClassName={inputClass}
                />
              )}
            </label>
          </div>
        </section>

        {isPlane ? (
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Flight</p>
            <label className="block">
              <FieldLabel>Flight number</FieldLabel>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={leg.flightNumber ?? ""}
                  onChange={(e) => {
                    setLookupError(null);
                    setLookupMessage(null);
                    onChange({ ...leg, flightNumber: e.target.value || null });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runFlightLookup();
                    }
                  }}
                  placeholder="e.g. NZ123"
                  className={inputClass}
                />
                <button
                  type="button"
                  disabled={lookupLoading || !leg.flightNumber?.trim()}
                  onClick={() => void runFlightLookup()}
                  className="h-10 shrink-0 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 sm:w-28"
                >
                  {lookupLoading ? "Looking up…" : "Look up"}
                </button>
              </div>
              {lookupError ? <p className="mt-1.5 text-xs text-red-600">{lookupError}</p> : null}
              {lookupMessage ? (
                <p className="mt-1.5 text-xs text-emerald-700">{lookupMessage}</p>
              ) : null}
            </label>
          </section>
        ) : null}

        <section className="min-w-0 space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Schedule</p>
          {isPlane ? (
            <div className="grid grid-cols-1 gap-4">
              <div className="min-w-0 space-y-2">
                <FieldLabel>Depart</FieldLabel>
                <input
                  type="date"
                  value={leg.travelDate}
                  onChange={(e) => {
                    const travelDate = e.target.value;
                    const nextArrival =
                      leg.arrivalDate && leg.arrivalDate !== leg.travelDate
                        ? leg.arrivalDate
                        : null;
                    onChange(
                      withSuggestedPlaneArrival({ ...leg, travelDate, arrivalDate: nextArrival }),
                    );
                  }}
                  className={inputClass}
                />
                <input
                  type="time"
                  step={300}
                  value={leg.departureTime ?? ""}
                  onChange={(e) =>
                    onChange(
                      withSuggestedPlaneArrival({
                        ...leg,
                        departureTime: e.target.value || null,
                      }),
                    )
                  }
                  className={inputClass}
                  aria-label="Departure time"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <FieldLabel>
                  Arrive <span className="font-normal text-zinc-400">(optional)</span>
                </FieldLabel>
                <input
                  type="date"
                  value={resolvedArrivalDate}
                  min={leg.travelDate}
                  onChange={(e) => {
                    const picked = e.target.value;
                    onChange({
                      ...leg,
                      arrivalDate: picked && picked !== leg.travelDate ? picked : null,
                    });
                  }}
                  className={inputClass}
                />
                <input
                  type="time"
                  step={300}
                  value={leg.arrivalTime ?? ""}
                  onChange={(e) =>
                    onChange(
                      withSuggestedPlaneArrival({
                        ...leg,
                        arrivalTime: e.target.value || null,
                      }),
                    )
                  }
                  className={inputClass}
                  aria-label="Arrival time"
                />
              </div>
            </div>
          ) : (
            <label className="block">
              <FieldLabel>Date</FieldLabel>
              <input
                type="date"
                value={leg.travelDate}
                onChange={(e) => onChange({ ...leg, travelDate: e.target.value })}
                className={inputClass}
              />
            </label>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-1">
          <button
            type="button"
            onClick={() => setShowDetails((open) => !open)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            {showDetails ? "Hide booking details" : "Booking details"}
          </button>
        </div>

        {showDetails ? (
          <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Type</FieldLabel>
                <select
                  value={leg.transportType}
                  onChange={(e) =>
                    onChange({ ...leg, transportType: e.target.value as TransportType })
                  }
                  className={inputClass}
                >
                  {TRANSPORT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TRANSPORT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <FieldLabel>Booking status</FieldLabel>
                <select
                  value={bookingValue}
                  onChange={(e) =>
                    onChange({ ...leg, bookingStatus: e.target.value as BookingStatus })
                  }
                  className={inputClass}
                >
                  <option value="booked">Booked</option>
                  <option value="placeholder">Placeholder</option>
                  <option value="flexible">Flexible</option>
                </select>
              </label>
            </div>
            {showBookingRef ? (
              <label className="block">
                <FieldLabel>Booking reference</FieldLabel>
                <input
                  value={leg.referenceNumber ?? ""}
                  onChange={(e) => onChange({ ...leg, referenceNumber: e.target.value || null })}
                  className={inputClass}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {roster ? (
          <VisibilityPicker
            compact
            value={{
              visibilityMode: leg.visibilityMode ?? "everyone",
              targets: leg.targets ?? [],
            }}
            onChange={setVisibility}
            groups={roster.groups}
            participants={roster.participants}
            rooms={roster.rooms}
          />
        ) : null}
      </div>
    </div>
  );
}
