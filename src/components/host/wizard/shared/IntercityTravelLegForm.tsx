"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";

import { AirportPicker } from "@/components/geo/AirportPicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import { TimeInput } from "@/components/ui/TimeInput";
import type { BookingStatus, IntercityLegDraft, TransportType } from "@/lib/host/wizard/types";

const MODE_OPTIONS: TransportType[] = [
  "unsure",
  "train",
  "bus",
  "car",
  "plane",
  "coach",
  "ferry",
  "taxi",
  "walking",
  "other",
];

const MODE_LABELS: Record<TransportType, string> = {
  unsure: "Unsure",
  plane: "Plane",
  train: "Train",
  bus: "Bus",
  coach: "Coach",
  ferry: "Ferry",
  car: "Driving",
  taxi: "Taxi",
  walking: "Walk",
  other: "Other",
};

const BOOKING_OPTIONS: Array<{ value: BookingStatus; label: string }> = [
  { value: "booked", label: "Booked" },
  { value: "placeholder", label: "Placeholder" },
  { value: "flexible", label: "Flexible" },
];

const inputClass =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm shadow-sm transition focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

function formatLegDate(iso: string): string {
  return DateTime.fromISO(iso).toFormat("d MMM yyyy");
}

function cityShort(name: string): string {
  return name.split(",")[0]?.trim() || name;
}

export function IntercityTravelLegForm({
  leg,
  onChange,
  countryNames = [],
  legHint,
  embedded = false,
}: {
  leg: IntercityLegDraft;
  onChange: (leg: IntercityLegDraft) => void;
  countryNames?: string[];
  legHint?: string;
  /** Sidebar-embedded: no outer card chrome — parent supplies the header. */
  embedded?: boolean;
}) {
  const [fromQuery, setFromQuery] = useState(leg.fromCity);
  const [toQuery, setToQuery] = useState(leg.toCity);
  const [showDetails, setShowDetails] = useState(false);

  const bookingStatus =
    leg.bookingStatus === "not_booked" ? "placeholder" : leg.bookingStatus;
  const isPlane = leg.transportType === "plane";
  const isFlexible = bookingStatus === "flexible";
  const destShort = cityShort(leg.intercityToCity);

  useEffect(() => {
    setFromQuery(leg.fromCity);
    setToQuery(leg.toCity);
  }, [leg.id, leg.fromCity, leg.toCity]);

  function patch(next: Partial<IntercityLegDraft>) {
    onChange({ ...leg, ...next });
  }

  const body = (
    <div className={embedded ? "space-y-4" : "space-y-5 p-5"}>
        <div
          className={
            embedded
              ? "flex flex-col gap-4"
              : "flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
          }
        >
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              How
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MODE_OPTIONS.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => patch({ transportType: mode })}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-medium transition",
                    leg.transportType === mode
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80",
                  ].join(" ")}
                >
                  {MODE_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          {!embedded ? (
          <div className="shrink-0 xl:min-w-[18rem]">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Status
            </p>
            <div className="inline-flex w-full rounded-xl border border-zinc-200 bg-zinc-50 p-1 sm:w-auto">
              {BOOKING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => patch({ bookingStatus: option.value })}
                  className={[
                    "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition sm:flex-none sm:px-4",
                    bookingStatus === option.value
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          ) : (
          <div className="shrink-0">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Status
            </p>
            <div className="flex w-full rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              {BOOKING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => patch({ bookingStatus: option.value })}
                  className={[
                    "flex-1 rounded-lg px-2 py-2 text-xs font-medium transition",
                    bookingStatus === option.value
                      ? "bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        <div
          className={
            embedded
              ? "grid gap-4"
              : "grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end"
          }
        >
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-zinc-600">
              {isPlane ? "From airport" : "Leaving from"}
            </span>
            {isPlane ? (
              <AirportPicker
                value={fromQuery}
                onChange={setFromQuery}
                onSelectOption={(v) => patch({ fromCity: v })}
                onBlur={() => {
                  if (fromQuery.trim() !== leg.fromCity.trim()) patch({ fromCity: fromQuery.trim() });
                }}
                inputClassName={inputClass}
              />
            ) : (
              <PlacePicker
                value={fromQuery}
                onChange={setFromQuery}
                onSelectOption={(v) => patch({ fromCity: v })}
                onBlur={() => {
                  if (fromQuery.trim() !== leg.fromCity.trim()) patch({ fromCity: fromQuery.trim() });
                }}
                countryNames={countryNames}
                inputClassName={inputClass}
              />
            )}
          </label>
          <span
            className="hidden self-center pb-3 text-xl text-zinc-300 lg:block"
            aria-hidden
          >
            →
          </span>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-zinc-600">
              {isPlane ? "To airport" : "Heading to"}
            </span>
            {isPlane ? (
              <AirportPicker
                value={toQuery}
                onChange={setToQuery}
                onSelectOption={(v) => patch({ toCity: v })}
                onBlur={() => {
                  if (toQuery.trim() !== leg.toCity.trim()) patch({ toCity: toQuery.trim() });
                }}
                inputClassName={inputClass}
              />
            ) : (
              <PlacePicker
                value={toQuery}
                onChange={setToQuery}
                onSelectOption={(v) => patch({ toCity: v })}
                onBlur={() => {
                  if (toQuery.trim() !== leg.toCity.trim()) patch({ toCity: toQuery.trim() });
                }}
                countryNames={countryNames}
                inputClassName={inputClass}
              />
            )}
          </label>
        </div>

        <div className={embedded ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-600">Depart</span>
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
              <input
                type="date"
                value={leg.travelDate}
                onChange={(e) => patch({ travelDate: e.target.value })}
                className={inputClass}
              />
              <TimeInput
                value={leg.departureTime}
                onChange={(departureTime) => patch({ departureTime })}
                disabled={isFlexible}
                inputClassName={inputClass}
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-zinc-600">
              Arrive <span className="font-normal text-zinc-400">(optional)</span>
            </span>
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
              <input
                type="date"
                value={leg.arrivalDate ?? leg.travelDate}
                min={leg.travelDate}
                onChange={(e) => {
                  const picked = e.target.value;
                  patch({
                    arrivalDate: picked && picked !== leg.travelDate ? picked : null,
                  });
                }}
                className={inputClass}
                disabled={isFlexible}
              />
              <TimeInput
                value={leg.arrivalTime}
                onChange={(arrivalTime) => patch({ arrivalTime })}
                disabled={isFlexible}
                inputClassName={inputClass}
              />
            </div>
          </label>
        </div>

        {isFlexible ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
            Calendar will show{" "}
            <span className="font-medium text-zinc-900">Depart for {destShort}</span> — pick a mode
            and times whenever you are ready.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowDetails((open) => !open)}
          className="text-xs font-medium text-zinc-500 transition hover:text-zinc-800"
        >
          {showDetails ? "− Hide extras" : "+ Flight number, operator, notes"}
        </button>

        {showDetails ? (
          <div className="grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 sm:grid-cols-2">
            {isPlane ? (
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Flight number (optional)
                </span>
                <input
                  value={leg.flightNumber ?? ""}
                  onChange={(e) => patch({ flightNumber: e.target.value || null })}
                  placeholder="NZ123"
                  className={inputClass}
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Operator (optional)
                </span>
                <input
                  value={leg.operator ?? ""}
                  onChange={(e) => patch({ operator: e.target.value || null })}
                  placeholder="e.g. JR Pass"
                  className={inputClass}
                />
              </label>
            )}
            {bookingStatus === "booked" && !isPlane ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Booking reference
                </span>
                <input
                  value={leg.referenceNumber ?? ""}
                  onChange={(e) => patch({ referenceNumber: e.target.value || null })}
                  className={inputClass}
                />
              </label>
            ) : null}
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Notes</span>
              <textarea
                value={leg.notes ?? ""}
                onChange={(e) => patch({ notes: e.target.value || null })}
                rows={2}
                className={`${inputClass} min-h-[4rem] resize-y py-2`}
              />
            </label>
          </div>
        ) : null}
      </div>
  );

  if (embedded) return body;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 bg-gradient-to-r from-zinc-50/90 to-white px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-zinc-900">
            {cityShort(leg.intercityFromCity)}{" "}
            <span className="font-normal text-zinc-400">→</span> {cityShort(leg.intercityToCity)}
          </h3>
          {legHint ? <p className="mt-1 text-xs leading-relaxed text-indigo-700">{legHint}</p> : null}
        </div>
        <time className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
          {formatLegDate(leg.travelDate)}
        </time>
      </header>
      {body}
    </article>
  );
}
