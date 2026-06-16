"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DateTime } from "luxon";

import { HotelNamePicker } from "@/components/geo/HotelNamePicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import { inferCityLabelFromAddress } from "@/lib/geo/accommodation-search";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import {
  stayDatesForSelection,
  stayForHalfSelection,
} from "@/lib/host/setup/day-selection-setup";
import { shortCityName } from "@/lib/host/setup/location-range-display";
import { dayPlacesForGroup, legsOnDate, staysForGroup } from "@/lib/trip-engine/selectors";
import {
  cityOnHalf,
  isHalfEmpty,
  locationsMatch,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import {
  isOvernightHubSecondaryOnDepartureDay,
} from "@/lib/host/wizard/transport-day-placement";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import type {
  CalendarRenderModel,
  EngineConflict,
  ProjectedDay,
  TripEntityGraph,
} from "@/lib/trip-engine/types";
import { newId } from "@/lib/host/wizard/types";

import { daysInSelection, type CalendarSelection } from "../calendar/useCalendarSelection";
import { AsyncButton } from "../shared/AsyncButton";
import { FlightLegQuickForm } from "../shared/FlightLegQuickForm";
import { TripDateInput } from "../shared/TripDateInput";
import { tripDatePickerContext } from "../shared/trip-date-picker";

type EditField = "location" | "accommodation" | "transport";

function projectedToDayPlace(day: ProjectedDay): DayPlaceDraft {
  return {
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: day.primaryShare,
    dayType: day.dayType,
    includeBuffer: false,
  };
}

function addDays(iso: string, delta: number): string {
  return DateTime.fromISO(iso).plus({ days: delta }).toISODate()!;
}

/** Nights are [checkIn, checkOut) — last selected calendar day needs checkout the day after. */
function stayDatesCoveringRange(
  rangeStart: string,
  rangeEnd: string,
  existing?: { checkIn: string; checkOut: string } | null,
): { checkIn: string; checkOut: string } {
  const selectionCheckout = addDays(rangeEnd, 1);
  if (!existing) {
    return { checkIn: rangeStart, checkOut: selectionCheckout };
  }
  return {
    checkIn: existing.checkIn < rangeStart ? existing.checkIn : rangeStart,
    checkOut:
      existing.checkOut > selectionCheckout ? existing.checkOut : selectionCheckout,
  };
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100";

function formatRangeDisplay(start: string, end: string): string {
  const s = DateTime.fromISO(start);
  const e = DateTime.fromISO(end);
  if (!s.isValid || !e.isValid) return `${start} → ${end}`;
  if (start === end) return s.toFormat("d MMM yyyy");
  if (s.year === e.year && s.month === e.month) {
    return `${s.toFormat("d")}–${e.toFormat("d MMM yyyy")}`;
  }
  if (s.year === e.year) {
    return `${s.toFormat("d MMM")} – ${e.toFormat("d MMM yyyy")}`;
  }
  return `${s.toFormat("d MMM yyyy")} – ${e.toFormat("d MMM yyyy")}`;
}

function legBucket(
  graph: TripEntityGraph,
  legId: string,
): "intercity" | "outbound" | "return" {
  if (graph.intercityLegs.some((x) => x.id === legId)) return "intercity";
  if (graph.outboundLegs.some((x) => x.id === legId)) return "outbound";
  return "return";
}

function stayCoveringDate(
  stays: AccommodationStayDraft[],
  date: string,
): AccommodationStayDraft | null {
  return (
    stays.find((s) => s.checkInDate <= date && s.checkOutDate >= date && s.name?.trim()) ?? null
  );
}

/** Stay for this night, or the booked stay that starts on the next day (travel → check-in). */
function stayLinkedToSelection(
  stays: AccommodationStayDraft[],
  rangeStart: string,
  rangeEnd: string,
): AccommodationStayDraft | null {
  const covering = stayCoveringRange(stays, rangeStart, rangeEnd);
  if (covering) return covering;

  const linked = stays
    .filter((s) => {
      if (!s.name?.trim() || s.checkOutDate <= rangeStart) return false;
      return s.checkInDate >= rangeStart && s.checkInDate <= addDays(rangeEnd, 2);
    })
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
  return linked[0] ?? null;
}

function stayCoveringRange(
  stays: AccommodationStayDraft[],
  rangeStart: string,
  rangeEnd: string,
): AccommodationStayDraft | null {
  const covering = stays.filter(
    (s) =>
      s.name?.trim() &&
      s.checkInDate <= rangeEnd &&
      s.checkOutDate >= rangeStart,
  );
  if (!covering.length) return null;
  if (covering.length === 1) return covering[0]!;
  const sameId = new Set(covering.map((s) => s.id));
  if (sameId.size === 1) return covering[0]!;
  const names = new Set(covering.map((s) => s.name?.trim()));
  if (names.size === 1) {
    return covering.sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))[0]!;
  }
  return null;
}

function locationSummaryForDay(projected: ProjectedDay | undefined): string {
  const parts: string[] = [];
  if (projected?.primaryCity.trim()) {
    parts.push(formatLocationSlice(projected.primaryCity, projected.primaryShare));
  }
  if (projected?.secondaryCity?.trim()) {
    parts.push(formatLocationSlice(projected.secondaryCity, 1 - projected.primaryShare));
  }
  return parts.length ? parts.join(" · ") : "Not selected";
}

function rangeLocationSummary(days: ProjectedDay[]): string {
  const labels = days.map((d) => locationSummaryForDay(d));
  const unique = [...new Set(labels)];
  if (unique.length === 1) return unique[0]!;
  return "Mixed across days";
}

function rangeAccommodationSummary(
  days: ProjectedDay[],
  rangeStart: string,
  rangeEnd: string,
  stays: AccommodationStayDraft[],
): string {
  const labels = days
    .map((d) => d.accommodationLabel?.trim())
    .filter((label): label is string => Boolean(label));
  const unique = [...new Set(labels)];
  if (unique.length === 1) return unique[0]!;
  if (unique.length > 1) return "Mixed across days";
  const linked = stayLinkedToSelection(stays, rangeStart, rangeEnd);
  if (linked?.name?.trim()) {
    if (linked.checkInDate > rangeStart) {
      return `${linked.name.trim()} · check-in ${linked.checkInDate} (edit to include this day)`;
    }
    return linked.name.trim();
  }
  return "No hotel in this range";
}

function isSplitTravelDay(
  projected: ProjectedDay | undefined,
  date: string,
  legs: TransportLegDraft[],
): boolean {
  if (!projected?.primaryCity.trim() || !projected.secondaryCity?.trim()) return false;
  if ((projected.primaryShare ?? 1) >= 0.99) return false;
  if (isOvernightHubSecondaryOnDepartureDay(date, projected, legs)) return false;
  return true;
}

function formatLocationSlice(city: string, share: number): string {
  const label = shortCityName(city);
  if (share >= 0.99) return label;
  const pct = Math.round(share * 100);
  return `${label} (${pct}%)`;
}

function legRouteLabel(leg: TransportLegDraft | IntercityLegDraft): string {
  const from = leg.fromCity?.trim() ?? "";
  const to = leg.toCity?.trim() ?? "";
  const flight = "flightNumber" in leg && leg.flightNumber ? ` · ${leg.flightNumber}` : "";
  return `${shortCityName(from)} → ${shortCityName(to)}${flight}`;
}

/** Maps often returns formal admin names — nudge hosts toward everyday labels like "Patong". */
function looksLikeFormalMapsCityLabel(city: string): boolean {
  const trimmed = city.trim();
  if (!trimmed) return false;
  if (trimmed.includes(",")) return true;
  return /\b(tambon|amphoe|chang wat|changwat|province|prefecture|regency|kabupaten)\b/i.test(
    trimmed,
  );
}

export function DayContextPanel(props: {
  graph: TripEntityGraph;
  groupId: string;
  model: CalendarRenderModel;
  selection: CalendarSelection;
  conflicts: EngineConflict[];
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onClearSelection: () => void;
  error?: string | null;
}) {
  const { selection, model, graph, groupId } = props;

  const rangeStart = selection.rangeStart;
  const rangeEnd = selection.rangeEnd || selection.rangeStart;
  const startHalf = selection.startHalf;
  const endHalf = selection.endHalf;
  const datePicker = tripDatePickerContext(graph, rangeStart);
  const selectedHalf: HalfSide | "full" =
    rangeStart === rangeEnd ? startHalf : "full";
  const isSingleHalfDay =
    Boolean(rangeStart) && rangeStart === rangeEnd && selectedHalf !== "full";
  const rangeLabel = rangeStart
    ? isSingleHalfDay
      ? `${DateTime.fromISO(rangeStart).toFormat("d MMM yyyy")} · ${selectedHalf === "left" ? "first half" : "second half"}`
      : rangeStart === rangeEnd
        ? DateTime.fromISO(rangeStart).toFormat("d MMM yyyy")
        : formatRangeDisplay(rangeStart, rangeEnd)
    : "";

  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [locationDraft, setLocationDraft] = useState("");
  const [departureDraft, setDepartureDraft] = useState("");
  const [arrivalDraft, setArrivalDraft] = useState("");
  const [stayDraft, setStayDraft] = useState<{
    id: string | null;
    name: string;
    city: string;
    address: string | null;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  const groupStays = useMemo(() => staysForGroup(graph, groupId), [graph, groupId]);

  const rangeConflicts = useMemo(() => {
    if (!rangeStart) return [];
    return props.conflicts.filter(
      (c) => !c.date || (c.date >= rangeStart && c.date <= rangeEnd),
    );
  }, [props.conflicts, rangeStart, rangeEnd]);

  const hasPaint = useMemo(() => {
    if (!rangeStart) return false;
    if (isSingleHalfDay) {
      const day = model.projectedDays.find((d) => d.date === rangeStart);
      if (!day) return false;
      return Boolean(
        cityOnHalf(projectedToDayPlace(day), selectedHalf).trim(),
      );
    }
    return daysInSelection(
      selection,
      model.projectedDays.map((d) => ({
        date: d.date,
        primaryCity: d.primaryCity,
        secondaryCity: d.secondaryCity,
        primaryShare: d.primaryShare,
        dayType: d.dayType,
        includeBuffer: false,
      })),
    ).some((d) => d.primaryCity.trim() || d.secondaryCity?.trim());
  }, [selection, model.projectedDays, rangeStart, isSingleHalfDay, selectedHalf]);

  const hasStay = Boolean(
    rangeStart &&
      (isSingleHalfDay
        ? stayForHalfSelection(groupStays, rangeStart, selectedHalf)
        : groupStays.some(
            (s) => s.checkInDate <= rangeEnd && s.checkOutDate >= rangeStart,
          )),
  );

  const overviewDays = useMemo(() => {
    if (!rangeStart) return [];
    const end = rangeEnd || rangeStart;
    const dates: string[] = [];
    let cursor = rangeStart;
    while (cursor <= end) {
      dates.push(cursor);
      cursor = DateTime.fromISO(cursor).plus({ days: 1 }).toISODate()!;
    }
    return dates.map((date) => {
      const projected = model.projectedDays.find((d) => d.date === date);
      const dayLegs = legsOnDate(graph, date);
      const stay = stayCoveringDate(groupStays, date);
      return { date, projected, dayLegs, stay };
    });
  }, [rangeStart, rangeEnd, model.projectedDays, graph, groupStays]);

  const projectedInRange = useMemo(
    () =>
      overviewDays
        .map((row) => row.projected)
        .filter((day): day is ProjectedDay => Boolean(day)),
    [overviewDays],
  );

  const legsInRange = useMemo(() => {
    const seen = new Set<string>();
    const legs: Array<TransportLegDraft | IntercityLegDraft> = [];
    for (const row of overviewDays) {
      for (const leg of row.dayLegs) {
        if (!seen.has(leg.id)) {
          seen.add(leg.id);
          legs.push(leg);
        }
      }
    }
    return legs;
  }, [overviewDays]);

  const linkedStay = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    if (isSingleHalfDay) {
      return stayForHalfSelection(groupStays, rangeStart, selectedHalf);
    }
    return stayLinkedToSelection(groupStays, rangeStart, rangeEnd);
  }, [groupStays, rangeStart, rangeEnd, isSingleHalfDay, selectedHalf]);

  const dayCount = overviewDays.length;
  const legsForSelectedDay = useMemo(
    () => (rangeStart ? legsOnDate(props.graph, rangeStart) : []),
    [props.graph, rangeStart],
  );
  const splitTravelDay =
    dayCount === 1 &&
    rangeStart &&
    isSplitTravelDay(projectedInRange[0], rangeStart, legsForSelectedDay);

  const anchorDay = projectedInRange.find((d) => d.date === rangeStart);
  const selectedHalfEmpty = Boolean(
    anchorDay &&
      selectedHalf !== "full" &&
      isHalfEmpty(projectedToDayPlace(anchorDay), selectedHalf),
  );
  const locationSummary =
    anchorDay && selectedHalf !== "full"
      ? selectedHalfEmpty
        ? "Not selected"
        : cityOnHalf(projectedToDayPlace(anchorDay), selectedHalf) || "Not selected"
      : rangeLocationSummary(projectedInRange);
  const accommodationSummary = isSingleHalfDay
    ? stayForHalfSelection(groupStays, rangeStart, selectedHalf)?.name?.trim() ||
      "No hotel in this range"
    : rangeAccommodationSummary(projectedInRange, rangeStart, rangeEnd, groupStays);
  const transportSummary = legsInRange.length
    ? legsInRange.map((leg) => legRouteLabel(leg)).join(" · ")
    : "No legs in this range";

  useEffect(() => {
    if (!editingField || !rangeStart) {
      setLocationDraft("");
      setDepartureDraft("");
      setArrivalDraft("");
      setStayDraft(null);
      return;
    }

    if (editingField === "location") {
      const day = projectedInRange[0];
      if (day && rangeStart && isSplitTravelDay(day, rangeStart, legsForSelectedDay)) {
        setDepartureDraft(day.primaryCity.trim());
        setArrivalDraft(day.secondaryCity?.trim() ?? "");
        setLocationDraft("");
      } else {
        const painted = projectedInRange
          .map((d) => d.primaryCity.trim())
          .filter(Boolean);
        const unique = [...new Set(painted)];
        setLocationDraft(unique.length === 1 ? unique[0]! : "");
        setDepartureDraft("");
        setArrivalDraft("");
      }
    }

    if (editingField === "accommodation") {
      const city =
        linkedStay
          ? stayCityLabel(linkedStay)
          : projectedInRange.find((d) => d.primaryCity.trim())?.primaryCity.trim() ||
            projectedInRange.find((d) => d.secondaryCity?.trim())?.secondaryCity?.trim() ||
            "";
      const dates = linkedStay
        ? {
            checkIn: linkedStay.checkInDate,
            checkOut: linkedStay.checkOutDate,
          }
        : stayDatesForSelection(selection, null);
      setStayDraft({
        id: linkedStay?.id ?? null,
        name: linkedStay?.name?.trim() || "",
        city,
        address: linkedStay?.address ?? null,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
      });
    }
  }, [editingField, projectedInRange, linkedStay, selection, rangeStart, legsForSelectedDay]);

  if (!rangeStart) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
        Select days on the calendar to view and edit locations, stays, and transport.
      </div>
    );
  }

  const applyLabel = isSingleHalfDay || rangeStart === rangeEnd
    ? "Save"
    : dayCount > 1
      ? `Apply to all ${dayCount} days`
      : "Save";

  async function saveLocation() {
    setActionError(null);

    if (splitTravelDay && rangeStart) {
      if (!departureDraft.trim() || !arrivalDraft.trim()) {
        setActionError("Enter both departure and arrival cities.");
        return;
      }
      const existing = dayPlacesForGroup(graph, groupId);
      const projected = projectedInRange[0];
      const updatedDay = {
        date: rangeStart,
        primaryCity: departureDraft.trim(),
        secondaryCity: arrivalDraft.trim(),
        primaryShare: projected?.primaryShare ?? 0.5,
        dayType: projected?.dayType ?? ("trip" as const),
        includeBuffer: false,
      };
      const days = existing.some((d) => d.date === rangeStart)
        ? existing.map((d) => (d.date === rangeStart ? { ...d, ...updatedDay } : d))
        : [...existing, updatedDay];
      const ok = await props.onDispatch([{ type: "setDayPlaces", groupId, days }]);
      if (ok) setEditingField(null);
      else setActionError(props.error || "Could not save location.");
      return;
    }

    if (!locationDraft.trim()) {
      setActionError("Enter a city or region.");
      return;
    }
    const ok = await props.onDispatch([
      {
        type: "paintDayRange",
        groupId,
        rangeStart,
        rangeEnd,
        location: locationDraft.trim(),
        startHalf,
        endHalf,
      },
    ]);
    if (ok) setEditingField(null);
    else setActionError(props.error || "Could not save location.");
  }

  async function saveStay() {
    setActionError(null);
    if (!stayDraft?.name.trim() || !stayDraft.checkIn || !stayDraft.checkOut) {
      setActionError("Hotel name and check-in/out dates are required.");
      return;
    }
    const mergedDates = stayDraft.id
      ? { checkIn: stayDraft.checkIn, checkOut: stayDraft.checkOut }
      : stayDatesForSelection(selection, {
          checkIn: stayDraft.checkIn,
          checkOut: stayDraft.checkOut,
        });
    if (mergedDates.checkOut <= mergedDates.checkIn) {
      setActionError("Check-out must be after check-in.");
      return;
    }
    const cityLabel = stayDraft.city.trim() || stayDraft.name.trim();
    const payload = {
      name: stayDraft.name.trim(),
      cityLabel,
      address: stayDraft.address,
      checkInDate: mergedDates.checkIn,
      checkOutDate: mergedDates.checkOut,
    };
    const commands: TripCommand[] = [];
    const needsLocationPaint =
      isSingleHalfDay && anchorDay
        ? isHalfEmpty(projectedToDayPlace(anchorDay), selectedHalf) ||
          !cityOnHalf(projectedToDayPlace(anchorDay), selectedHalf).trim()
        : overviewDays.some((row) => {
            const p = row.projected;
            if (!p) return true;
            if (isSplitTravelDay(p, row.date, row.dayLegs)) {
              return !locationsMatch(p.secondaryCity?.trim() ?? "", cityLabel);
            }
            return !p.primaryCity.trim();
          });
    if (needsLocationPaint && cityLabel) {
      if (splitTravelDay && rangeStart) {
        const existing = dayPlacesForGroup(graph, groupId);
        const projected = projectedInRange[0];
        const updatedDay = {
          date: rangeStart,
          primaryCity: projected?.primaryCity.trim() || departureDraft.trim() || graph.basics.departureCity,
          secondaryCity: cityLabel,
          primaryShare: projected?.primaryShare ?? 0.5,
          dayType: projected?.dayType ?? ("trip" as const),
          includeBuffer: false,
        };
        const days = existing.some((d) => d.date === rangeStart)
          ? existing.map((d) => (d.date === rangeStart ? { ...d, ...updatedDay } : d))
          : [...existing, updatedDay];
        commands.push({ type: "setDayPlaces", groupId, days });
      } else {
        commands.push({
          type: "paintDayRange",
          groupId,
          rangeStart,
          rangeEnd,
          location: cityLabel,
          startHalf,
          endHalf,
        });
      }
    }
    if (stayDraft.id) {
      commands.push({
        type: "updateStay",
        groupId,
        stayId: stayDraft.id,
        patch: payload,
      });
    } else {
      commands.push({
        type: "addStay",
        groupId,
        stay: {
          id: newId(),
          stayType: "hotel",
          url: null,
          phone: null,
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
          ...payload,
        },
      });
    }
    const ok = await props.onDispatch(commands);
    if (ok) setEditingField(null);
    else setActionError(props.error || "Could not save stay.");
  }

  async function removeStay() {
    if (!linkedStay) return;
    if (!window.confirm("Remove this stay?")) return;
    const ok = await props.onDispatch([
      { type: "removeStay", groupId, stayId: linkedStay.id },
    ]);
    if (ok) setEditingField(null);
  }

  async function addTransportLegs(legs: IntercityLegDraft[]) {
    if (!legs.length) return false;
    const ok = await props.onDispatch([
      {
        type: "addClassifiedTransportLegs",
        groupId,
        legs,
      },
    ]);
    if (ok) setEditingField(null);
    return ok;
  }

  async function removeLeg(leg: TransportLegDraft | IntercityLegDraft) {
    await props.onDispatch([
      {
        type: "removeTransportLeg",
        groupId,
        bucket: legBucket(graph, leg.id),
        legId: leg.id,
      },
    ]);
  }

  async function clearRange() {
    if (!window.confirm(`Clear content for ${rangeLabel}?`)) return;
    await props.onDispatch([
      { type: "clearDayRange", groupId, rangeStart, rangeEnd },
    ]);
    props.onClearSelection();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Day editor</h2>
          <p className="text-sm text-zinc-600">{rangeLabel}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {isSingleHalfDay
              ? "Edits apply to this half-day only."
              : dayCount > 1
                ? `Edits apply to all ${dayCount} selected days.`
                : "Edits apply to this day."}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onClearSelection}
          className="text-sm text-zinc-600 hover:underline"
        >
          Dismiss
        </button>
      </div>

      {props.error || actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {actionError || props.error}
        </p>
      ) : null}

      {rangeConflicts.length ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {rangeConflicts.map((c) => (
            <li key={c.id}>{c.message}</li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-xl border border-zinc-200 p-4 text-sm">
        <h3 className="font-medium text-zinc-900">
          {isSingleHalfDay
            ? "Selected half-day"
            : dayCount > 1
              ? `Selected range (${dayCount} days)`
              : "Selected day"}
        </h3>

        <SectionSummaryRow
          label="Location"
          summary={locationSummary}
          isEmpty={!hasPaint}
          isActive={editingField === "location"}
          onSelect={() => setEditingField("location")}
        />
        <SectionSummaryRow
          label="Accommodation"
          summary={accommodationSummary}
          isEmpty={!hasStay && accommodationSummary === "No hotel in this range"}
          isActive={editingField === "accommodation"}
          onSelect={() => setEditingField("accommodation")}
        />
        <SectionSummaryRow
          label="Transport"
          summary={transportSummary}
          isEmpty={legsInRange.length === 0}
          isActive={editingField === "transport"}
          onSelect={() => setEditingField("transport")}
        />
      </div>

      {editingField === "location" ? (
        <SectionEditorPanel label="Location" onClose={() => setEditingField(null)}>
          {splitTravelDay ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Departing from</span>
                <PlacePicker
                  value={departureDraft}
                  onChange={setDepartureDraft}
                  placeholder="Origin city…"
                  inputClassName={inputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-zinc-500">Arriving to (stay city)</span>
                <PlacePicker
                  value={arrivalDraft}
                  onChange={setArrivalDraft}
                  placeholder="e.g. Patong, not Phuket airport…"
                  inputClassName={inputClass}
                />
              </label>
              <p className="text-xs text-zinc-500">
                Travel day — set arrival to your stay city (Patong) so it connects to the
                hotel block.
              </p>
            </>
          ) : (
            <>
              <PlacePicker
                value={locationDraft}
                onChange={setLocationDraft}
                placeholder="Search city or region…"
                inputClassName={inputClass}
              />
              <p className="text-xs text-zinc-500">
                Applies to {formatRangeDisplay(rangeStart, rangeEnd)}.
              </p>
            </>
          )}
          <div className="flex gap-2">
            <AsyncButton
              onClick={() => void saveLocation()}
              loading={props.saving}
              loadingLabel="Saving…"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              {applyLabel} location
            </AsyncButton>
            <button
              type="button"
              onClick={() => setEditingField(null)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
            >
              Cancel
            </button>
          </div>
        </SectionEditorPanel>
      ) : null}

      {editingField === "accommodation" && stayDraft ? (
        <SectionEditorPanel label="Accommodation" onClose={() => setEditingField(null)}>
          <div className="space-y-2">
            <HotelNamePicker
              value={stayDraft.name}
              onChange={(name) => setStayDraft({ ...stayDraft, name })}
              onSelectHotel={({ name, address, cityLabel }) => {
                setStayDraft({
                  ...stayDraft,
                  name,
                  address: address || null,
                  city:
                    cityLabel?.trim() ||
                    inferCityLabelFromAddress(address) ||
                    stayDraft.city,
                });
              }}
              stayType="hotel"
              cityHint={stayDraft.city}
              placeholder="Search property on Google Maps…"
              inputClassName={inputClass}
            />
            <label className="block space-y-1.5">
              <span className="text-xs text-zinc-500">Stay city (calendar label)</span>
              <PlacePicker
                value={stayDraft.city}
                onChange={(city) => setStayDraft({ ...stayDraft, city })}
                placeholder="e.g. Patong"
                inputClassName={inputClass}
              />
              {looksLikeFormalMapsCityLabel(stayDraft.city) ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-950">
                  Maps often uses formal area names here. Change this to how you&apos;d actually
                  describe the stay — e.g. <span className="font-medium">Patong</span>, not Tambon
                  Patong, Chang Wat Phuket.
                </p>
              ) : null}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">Check-in</span>
                <TripDateInput
                  value={stayDraft.checkIn}
                  onChange={(checkIn) => setStayDraft({ ...stayDraft, checkIn })}
                  tripStart={datePicker.tripStart}
                  tripEnd={datePicker.tripEnd}
                  anchorDate={datePicker.anchorDate}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-zinc-500">Check-out (morning after last night)</span>
                <TripDateInput
                  value={stayDraft.checkOut}
                  onChange={(checkOut) => setStayDraft({ ...stayDraft, checkOut })}
                  tripStart={datePicker.tripStart}
                  tripEnd={datePicker.tripEnd}
                  anchorDate={datePicker.anchorDate}
                  className={inputClass}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              {linkedStay && linkedStay.checkInDate > rangeStart
                ? `Saving merges with your existing stay (check-in moves to ${stayDraft?.checkIn}).`
                : isSingleHalfDay
                  ? "Check-in/out dates follow hotel convention; your calendar selection stays on this half."
                  : dayCount > 1
                    ? "Dates in the form are saved as entered — they are not auto-extended to the selected range."
                    : "Saving updates this stay on the calendar."}
            </p>
            <div className="flex flex-wrap gap-2">
              <AsyncButton
                onClick={() => void saveStay()}
                loading={props.saving}
                loadingLabel="Saving…"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                {applyLabel} stay
              </AsyncButton>
              {linkedStay ? (
                <button
                  type="button"
                  onClick={() => void removeStay()}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-800"
                >
                  Remove stay
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </SectionEditorPanel>
      ) : null}

      {editingField === "transport" ? (
        <SectionEditorPanel label="Transport" onClose={() => setEditingField(null)}>
          {legsInRange.length ? (
            <ul className="space-y-1">
              {legsInRange.map((leg) => (
                <li
                  key={leg.id}
                  className="flex items-center justify-between rounded border border-zinc-100 px-2 py-1.5"
                >
                  <span>
                    {leg.travelDate} · {legRouteLabel(leg)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeLeg(leg)}
                    className="text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <FlightLegQuickForm
            groupId={groupId}
            defaultDate={rangeStart}
            anchorDate={datePicker.anchorDate}
            saving={props.saving}
            onSubmit={addTransportLegs}
          />
          <button
            type="button"
            onClick={() => setEditingField(null)}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
          >
            Done
          </button>
        </SectionEditorPanel>
      ) : null}

      {(hasPaint || hasStay) && (
        <button
          type="button"
          onClick={() => void clearRange()}
          className="text-sm font-medium text-red-700 hover:underline"
        >
          Clear selected range
        </button>
      )}
    </div>
  );
}

function SectionSummaryRow(props: {
  label: string;
  summary: string;
  isEmpty?: boolean;
  isActive?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={[
        "mt-3 flex w-full items-start justify-between gap-3 rounded-lg border px-1 py-1.5 text-left",
        props.isActive
          ? "border-indigo-200 bg-indigo-50/50"
          : "border-transparent hover:border-zinc-200 hover:bg-zinc-50",
      ].join(" ")}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {props.label}
        </p>
        <p className="mt-0.5 text-zinc-800">{props.summary}</p>
      </div>
      <span className="shrink-0 text-xs font-medium text-indigo-700">
        {props.isEmpty ? "Add" : "Edit"}
      </span>
    </button>
  );
}

function SectionEditorPanel(props: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-800">
          {props.label}
        </p>
        <button
          type="button"
          onClick={props.onClose}
          className="text-xs font-medium text-zinc-600 hover:underline"
        >
          Close
        </button>
      </div>
      <div className="space-y-2">{props.children}</div>
    </div>
  );
}
