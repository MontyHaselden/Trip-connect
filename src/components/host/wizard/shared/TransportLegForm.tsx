"use client";

import { useEffect, useState } from "react";

import { AirportPicker } from "@/components/geo/AirportPicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import { TimeInput } from "@/components/ui/TimeInput";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { BookingStatus, TransportLegDraft, TransportType } from "@/lib/host/wizard/types";
import { BOOKING_STATUSES, TRANSPORT_TYPES } from "@/lib/host/wizard/types";

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
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-sm focus:border-zinc-400 focus:outline-none";

export function TransportLegForm({
  leg,
  onChange,
  onRemove,
  showRemove,
  countryNames = [],
  legTitle,
  legHint,
}: {
  leg: TransportLegDraft;
  onChange: (leg: TransportLegDraft) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  countryNames?: string[];
  legTitle: string;
  legHint?: string;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [fromQuery, setFromQuery] = useState(leg.fromCity);
  const [toQuery, setToQuery] = useState(leg.toCity);
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

  return (
    <div className="overflow-visible rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-900">{legTitle}</p>
          {legHint ? <p className="mt-0.5 text-xs text-indigo-700">{legHint}</p> : null}
        </div>
        {showRemove && onRemove ? (
          <button type="button" onClick={onRemove} className="shrink-0 text-xs text-red-600">
            Remove
          </button>
        ) : null}
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              {isPlane ? "From airport" : "From"}
            </span>
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
          <span className="hidden pb-2 text-center text-lg text-zinc-300 sm:block" aria-hidden>
            →
          </span>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              {isPlane ? "To airport" : "To"}
            </span>
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

        {isPlane ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Depart</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={leg.travelDate}
                  onChange={(e) => {
                    const travelDate = e.target.value;
                    const nextArrival =
                      leg.arrivalDate && leg.arrivalDate !== leg.travelDate ? leg.arrivalDate : null;
                    onChange(withSuggestedPlaneArrival({ ...leg, travelDate, arrivalDate: nextArrival }));
                  }}
                  className={inputClass}
                />
                <TimeInput
                  value={leg.departureTime}
                  onChange={(departureTime) =>
                    onChange(withSuggestedPlaneArrival({ ...leg, departureTime }))
                  }
                  inputClassName={inputClass}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">
                Arrive <span className="font-normal text-zinc-400">(optional)</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
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
                <TimeInput
                  value={leg.arrivalTime}
                  onChange={(arrivalTime) =>
                    onChange(withSuggestedPlaneArrival({ ...leg, arrivalTime }))
                  }
                  inputClassName={inputClass}
                />
              </div>
            </label>
          </div>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Date</span>
            <input
              type="date"
              value={leg.travelDate}
              onChange={(e) => onChange({ ...leg, travelDate: e.target.value })}
              className={inputClass}
            />
          </label>
        )}

        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
        >
          {showDetails ? "Hide booking details" : "Booking details"}
        </button>

        {showDetails ? (
          <div className="space-y-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Type</span>
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
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Booking</span>
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
            {isPlane ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Flight number (optional)
                </span>
                <input
                  value={leg.flightNumber ?? ""}
                  onChange={(e) => onChange({ ...leg, flightNumber: e.target.value || null })}
                  placeholder="NZ123"
                  className={inputClass}
                />
              </label>
            ) : null}
            {showBookingRef ? (
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-zinc-600">Booking reference</span>
                <input
                  value={leg.referenceNumber ?? ""}
                  onChange={(e) => onChange({ ...leg, referenceNumber: e.target.value || null })}
                  className={inputClass}
                />
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
