"use client";

import { useEffect } from "react";

import { PlacePicker } from "@/components/geo/PlacePicker";
import { TripTimezoneNote } from "@/components/geo/TripTimezoneNote";
import { buildDefaultDayPlaces } from "@/lib/host/wizard/detect-city-moves";
import { DAY_TYPES, type DayPlaceDraft, type TripWizardDraft } from "@/lib/host/wizard/types";

const DAY_TYPE_LABELS: Record<DayPlaceDraft["dayType"], string> = {
  trip: "Trip day",
  travel: "Travel day",
  meeting: "Meeting day",
  free: "Free day",
  buffer: "Buffer day",
  return: "Return day",
};

export function DatesPlacesStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  const { basics, dayPlaces } = draft;

  useEffect(() => {
    if (dayPlaces.length > 0 || !basics.startDate || !basics.endDate) return;
    onChange({
      ...draft,
      dayPlaces: buildDefaultDayPlaces(
        basics.startDate,
        basics.endDate,
        basics.departureCity,
        basics.returnCity,
      ),
    });
  }, [basics.startDate, basics.endDate, basics.departureCity, basics.returnCity, dayPlaces.length]);

  function updateDay(i: number, patch: Partial<DayPlaceDraft>) {
    onChange({
      ...draft,
      dayPlaces: dayPlaces.map((d, j) => (j === i ? { ...d, ...patch } : d)),
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Where are you when?</h2>
      <p className="text-sm text-zinc-600">
        Assign a city to each date. Buffer days before/after only appear to students when they have
        events.
      </p>
      {!basics.startDate || !basics.endDate ? (
        <p className="text-sm text-amber-700">Set trip dates in Basics first.</p>
      ) : (
        <div className="space-y-2">
          {dayPlaces.map((day, i) => {
            const isBuffer = day.dayType === "buffer";
            const travelLabel =
              day.dayType === "travel" && day.secondaryCity
                ? `${day.primaryCity} → ${day.secondaryCity}`
                : day.primaryCity;
            return (
              <div
                key={day.date}
                className={[
                  "grid gap-2 rounded-xl border p-3 sm:grid-cols-[120px_1fr_1fr_auto]",
                  isBuffer ? "border-dashed border-zinc-300 bg-zinc-50" : "border-zinc-200",
                ].join(" ")}
              >
                <div className="text-sm font-medium">{day.date}</div>
                <PlacePicker
                  value={day.primaryCity}
                  onChange={(primaryCity) => updateDay(i, { primaryCity })}
                  placeholder="Primary city"
                  countryNames={basics.destinationCountries}
                  inputClassName="h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm focus:border-zinc-400 focus:outline-none"
                />
                <PlacePicker
                  value={day.secondaryCity ?? ""}
                  onChange={(secondaryCity) =>
                    updateDay(i, { secondaryCity: secondaryCity || null })
                  }
                  placeholder="Second city (travel days)"
                  countryNames={basics.destinationCountries}
                  inputClassName="h-9 w-full rounded-lg border border-zinc-200 px-2 text-sm focus:border-zinc-400 focus:outline-none"
                />
                <select
                  value={day.dayType}
                  onChange={(e) =>
                    updateDay(i, { dayType: e.target.value as DayPlaceDraft["dayType"] })
                  }
                  className="h-9 rounded-lg border border-zinc-200 px-2 text-sm"
                >
                  {DAY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DAY_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                {isBuffer ? (
                  <label className="col-span-full flex items-center gap-2 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={day.includeBuffer}
                      onChange={(e) => updateDay(i, { includeBuffer: e.target.checked })}
                    />
                    Include this buffer day in itinerary
                  </label>
                ) : null}
                {day.dayType === "travel" && day.primaryCity && day.secondaryCity ? (
                  <p className="col-span-full text-xs text-sky-700">{travelLabel}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <TripTimezoneNote
        countries={basics.destinationCountries}
        cities={dayPlaces.map((d) => d.primaryCity).filter(Boolean)}
        departureCity={basics.departureCity}
        currentTimezone={basics.timezone}
        onTimezoneResolved={(timezone) =>
          onChange({ ...draft, basics: { ...basics, timezone } })
        }
      />
    </div>
  );
}
