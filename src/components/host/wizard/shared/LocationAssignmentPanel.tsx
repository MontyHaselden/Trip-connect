"use client";

import { DateTime } from "luxon";

import { PlacePicker } from "@/components/geo/PlacePicker";
import type { LocationStayDraft } from "@/lib/host/wizard/location-stays";

function formatRangeDate(iso: string): string {
  return DateTime.fromISO(iso).toFormat("d MMM");
}

export function LocationAssignmentPanel({
  extendingStay,
  location,
  onLocationChange,
  rangeStart,
  rangeEnd,
  onConfirm,
  onClearDates,
  countryNames,
  layout = "stacked",
}: {
  extendingStay?: string;
  location: string;
  onLocationChange: (location: string) => void;
  rangeStart: string;
  rangeEnd: string;
  onConfirm: () => void;
  onClearDates?: () => void;
  countryNames: string[];
  layout?: "stacked" | "sidebar";
}) {
  const title = extendingStay ? `Extend ${extendingStay}` : "Assign stay";
  const rangeReady = Boolean(rangeStart && location.trim());
  const selectedCount =
    rangeStart && rangeEnd
      ? Math.max(
          1,
          DateTime.fromISO(rangeEnd).diff(DateTime.fromISO(rangeStart), "days").days + 1,
        )
      : 0;

  const sidebar = layout === "sidebar";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <div
        className={[
          "border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-white",
          sidebar ? "px-4 py-3.5" : "px-5 py-4",
        ].join(" ")}
      >
        <h3 className={["font-semibold tracking-tight text-zinc-900", sidebar ? "text-base" : "text-lg"].join(" ")}>
          {title}
        </h3>
        {!sidebar ? (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600">
            {extendingStay
              ? "This connects to an existing stay on the calendar — confirming will extend that stay, not add a separate one."
              : "Choose where the group is based for the selected days. Edge days are automatically half-filled for travel."}
          </p>
        ) : (
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
            Choose a place for the selected days. Last day of each range is half-filled for travel.
          </p>
        )}
      </div>

      <div className={sidebar ? "space-y-4 px-4 py-4" : "space-y-5 px-5 py-5"}>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">Where</span>
          <div className="mt-2">
            <PlacePicker
              value={location}
              onChange={onLocationChange}
              placeholder="e.g. Tokyo, Japan"
              countryNames={countryNames}
              inputClassName="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 text-sm shadow-inner transition focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        </label>

        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3">
          {rangeStart ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-900">
                {rangeStart === rangeEnd
                  ? formatRangeDate(rangeStart)
                  : `${formatRangeDate(rangeStart)} → ${formatRangeDate(rangeEnd)}`}
                {selectedCount > 1 ? (
                  <span className="ml-2 font-normal text-zinc-500">({selectedCount} days)</span>
                ) : null}
              </p>
              {onClearDates ? (
                <button
                  type="button"
                  onClick={onClearDates}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
                >
                  Clear
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-zinc-600">
              Tap days on the calendar — each click adds to this stay.
            </p>
          )}
        </div>

        <div className={sidebar ? "flex flex-col gap-2.5" : "flex flex-wrap gap-3"}>
          <button
            type="button"
            disabled={!rangeReady}
            onClick={onConfirm}
            className={[
              "h-11 rounded-xl bg-zinc-900 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40",
              sidebar ? "w-full" : "px-5",
            ].join(" ")}
          >
            {extendingStay ? `Add to ${extendingStay}` : "Confirm stay"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmedStaysList({
  stays,
  onRemove,
  onClearAll,
}: {
  stays: LocationStayDraft[];
  onRemove: (index: number) => void;
  onClearAll?: () => void;
}) {
  if (!stays.length) return null;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">Confirmed stays</h3>
        {onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-red-600 transition hover:text-red-700"
          >
            Clear all
          </button>
        ) : null}
      </div>
      <ul className="mt-3 space-y-2">
        {stays.map((stay, i) => (
          <li
            key={`${stay.location}-${stay.startDate}-${stay.endDate}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-zinc-900">{stay.location}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {stay.startDate === stay.endDate
                  ? formatRangeDate(stay.startDate)
                  : `${formatRangeDate(stay.startDate)} → ${formatRangeDate(stay.endDate)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-xs font-medium text-zinc-500 transition hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
