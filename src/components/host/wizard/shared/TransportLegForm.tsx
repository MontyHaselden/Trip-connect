"use client";

import { PlacePicker } from "@/components/geo/PlacePicker";
import type { BookingStatus, TransportLegDraft, TransportType } from "@/lib/host/wizard/types";
import { BOOKING_STATUSES, TRANSPORT_TYPES, newId } from "@/lib/host/wizard/types";

const TRANSPORT_LABELS: Record<TransportType, string> = {
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

export function emptyTransportLeg(date = ""): TransportLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "not_booked",
    travelDate: date,
    departureTime: null,
    arrivalTime: null,
    fromCity: "",
    toCity: "",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
  };
}

export function TransportLegForm({
  leg,
  onChange,
  onRemove,
  showRemove,
  countryNames = [],
}: {
  leg: TransportLegDraft;
  onChange: (leg: TransportLegDraft) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  countryNames?: string[];
}) {
  const { bookingStatus } = leg;
  const showBookingRef = bookingStatus === "booked";
  const showFullDetails = bookingStatus === "placeholder";

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-800">Transport leg</span>
        {showRemove && onRemove ? (
          <button type="button" onClick={onRemove} className="text-xs text-red-600">
            Remove
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Type</span>
          <select
            value={leg.transportType}
            onChange={(e) =>
              onChange({ ...leg, transportType: e.target.value as TransportType })
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
          >
            {TRANSPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSPORT_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Booking</span>
          <select
            value={leg.bookingStatus}
            onChange={(e) =>
              onChange({ ...leg, bookingStatus: e.target.value as BookingStatus })
            }
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
          >
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "booked"
                  ? "Booked"
                  : s === "not_booked"
                    ? "Not booked yet"
                    : "Placeholder"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Date</span>
          <input
            type="date"
            value={leg.travelDate}
            onChange={(e) => onChange({ ...leg, travelDate: e.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
          />
        </label>
        {showBookingRef && leg.transportType === "plane" ? (
          <label className="block text-sm">
            <span className="font-medium">Flight number</span>
            <input
              value={leg.flightNumber ?? ""}
              onChange={(e) => onChange({ ...leg, flightNumber: e.target.value || null })}
              placeholder="NZ123"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
            />
          </label>
        ) : null}
        {showBookingRef && leg.transportType !== "plane" ? (
          <label className="block text-sm">
            <span className="font-medium">Booking reference</span>
            <input
              value={leg.referenceNumber ?? ""}
              onChange={(e) => onChange({ ...leg, referenceNumber: e.target.value || null })}
              placeholder="Confirmation or ticket number"
              className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
            />
          </label>
        ) : null}
        {showFullDetails ? (
          <>
            <label className="block text-sm">
              <span className="font-medium">Departure time</span>
              <input
                type="time"
                value={leg.departureTime ?? ""}
                onChange={(e) => onChange({ ...leg, departureTime: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Arrival time</span>
              <input
                type="time"
                value={leg.arrivalTime ?? ""}
                onChange={(e) => onChange({ ...leg, arrivalTime: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
              />
            </label>
          </>
        ) : null}
        <label className="block text-sm">
          <span className="font-medium">From city</span>
          <div className="mt-1">
            <PlacePicker
              value={leg.fromCity}
              onChange={(fromCity) => onChange({ ...leg, fromCity })}
              countryNames={countryNames}
              inputClassName="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm focus:border-zinc-400 focus:outline-none"
            />
          </div>
        </label>
        <label className="block text-sm">
          <span className="font-medium">To city</span>
          <div className="mt-1">
            <PlacePicker
              value={leg.toCity}
              onChange={(toCity) => onChange({ ...leg, toCity })}
              countryNames={countryNames}
              inputClassName="h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm focus:border-zinc-400 focus:outline-none"
            />
          </div>
        </label>
        {showFullDetails ? (
          <>
            <label className="block text-sm">
              <span className="font-medium">From station/airport</span>
              <input
                value={leg.fromStation ?? ""}
                onChange={(e) => onChange({ ...leg, fromStation: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">To station/airport</span>
              <input
                value={leg.toStation ?? ""}
                onChange={(e) => onChange({ ...leg, toStation: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
              />
            </label>
            {leg.transportType === "plane" ? (
              <label className="block text-sm">
                <span className="font-medium">Flight number</span>
                <input
                  value={leg.flightNumber ?? ""}
                  onChange={(e) => onChange({ ...leg, flightNumber: e.target.value || null })}
                  placeholder="NZ123"
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="font-medium">Booking reference</span>
                <input
                  value={leg.referenceNumber ?? ""}
                  onChange={(e) => onChange({ ...leg, referenceNumber: e.target.value || null })}
                  placeholder="Confirmation or ticket number"
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
                />
              </label>
            )}
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Operator / airline</span>
              <input
                value={leg.operator ?? ""}
                onChange={(e) => onChange({ ...leg, operator: e.target.value || null })}
                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Notes</span>
              <textarea
                value={leg.notes ?? ""}
                onChange={(e) => onChange({ ...leg, notes: e.target.value || null })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-1 text-sm"
              />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
