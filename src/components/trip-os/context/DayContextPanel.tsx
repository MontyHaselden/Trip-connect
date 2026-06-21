"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DateTime } from "luxon";

import { HotelNamePicker } from "@/components/geo/HotelNamePicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import {
  inferCityLabelFromAddress,
  looksLikeFormalMapsCityLabel,
  resolveStayCityOnHotelPick,
  suggestKeepStayCityLabel,
} from "@/lib/geo/accommodation-search";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import {
  detectAccommodationLocationConflicts,
  halfForDateInSelection,
  locationLabelForSelectedHalf,
  stayDatesForSelection,
  stayDatesForRangeApply,
  stayForHalfSelection,
  stayLinkedToHalfAwareSelection,
  type AccommodationLocationConflict,
} from "@/lib/host/setup/day-selection-setup";
import { shortCityName } from "@/lib/host/setup/location-range-display";
import { dayPlacesForGroup, legsOnDate, staysForGroup } from "@/lib/trip-engine/selectors";
import {
  cityOnHalf,
  enumerateDates,
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
import { AccommodationLocationConflictDialog } from "./AccommodationLocationConflictDialog";
import { DayOverviewActivities } from "./DayOverviewActivities";
import { FlightLegQuickForm } from "../shared/FlightLegQuickForm";
import { tripFieldClass } from "../shared/TripInput";
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

const inputClass = tripFieldClass;

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

function sliceLocationSummary(
  projected: ProjectedDay | undefined,
  half: HalfSide | "full",
): string {
  if (!projected) return "Not selected";
  const day = projectedToDayPlace(projected);
  if (half === "full") return locationSummaryForDay(projected);
  const city = cityOnHalf(day, half).trim();
  if (!city) return "Not selected";
  const share = half === "left" ? day.primaryShare ?? 0.5 : 1 - (day.primaryShare ?? 0.5);
  return formatLocationSlice(city, share);
}

function rangeLocationSummaryHalfAware(
  projectedDays: ProjectedDay[],
  selection: CalendarSelection,
): string {
  const end = selection.rangeEnd || selection.rangeStart;
  const labels: string[] = [];
  for (const iso of enumerateDates(selection.rangeStart, end)) {
    const projected = projectedDays.find((d) => d.date === iso);
    labels.push(sliceLocationSummary(projected, halfForDateInSelection(selection, iso)));
  }
  const meaningful = labels.filter((l) => l !== "Not selected");
  if (!meaningful.length) return "Not selected";
  const unique = [...new Set(meaningful)];
  if (unique.length === 1) return unique[0]!;
  return "Mixed across days";
}

function rangeAccommodationSummaryHalfAware(
  selection: CalendarSelection,
  stays: AccommodationStayDraft[],
): string {
  const end = selection.rangeEnd || selection.rangeStart;
  const labels: string[] = [];
  for (const iso of enumerateDates(selection.rangeStart, end)) {
    const half = halfForDateInSelection(selection, iso);
    const stay = stayForHalfSelection(stays, iso, half);
    if (stay?.name?.trim()) labels.push(stay.name.trim());
  }
  const unique = [...new Set(labels)];
  if (unique.length === 1) return unique[0]!;
  if (unique.length > 1) return "Mixed across days";
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

function splitDayTransitionSummary(left: string | undefined, right: string | undefined): string | null {
  const l = left?.trim();
  const r = right?.trim();
  if (!l || !r) return null;
  if (locationsMatch(l, r)) return shortCityName(l) || l;
  return `${shortCityName(l) || l} → ${shortCityName(r) || r}`;
}

function splitDayLocationSummary(projected: ProjectedDay | undefined): string | null {
  if (!projected) return null;
  return splitDayTransitionSummary(projected.primaryCity, projected.secondaryCity ?? undefined);
}

function splitDayAccommodationSummary(
  stays: AccommodationStayDraft[],
  date: string,
): string | null {
  const left = stayForHalfSelection(stays, date, "left")?.name?.trim();
  const right = stayForHalfSelection(stays, date, "right")?.name?.trim();
  return splitDayTransitionSummary(left, right);
}

function legRouteLabel(leg: TransportLegDraft | IntercityLegDraft): string {
  const from = leg.fromCity?.trim() ?? "";
  const to = leg.toCity?.trim() ?? "";
  const flight = "flightNumber" in leg && leg.flightNumber ? ` · ${leg.flightNumber}` : "";
  return `${shortCityName(from)} → ${shortCityName(to)}${flight}`;
}

function stayDraftCityLabel(draft: {
  name: string;
  city: string;
  address: string | null;
}): string {
  return (
    draft.city.trim() ||
    inferCityLabelFromAddress(draft.address ?? "") ||
    draft.name.trim()
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
  const [stayConflictDialog, setStayConflictDialog] = useState<{
    cityLabel: string;
    conflicts: AccommodationLocationConflict[];
  } | null>(null);

  const groupStays = useMemo(() => staysForGroup(graph, groupId), [graph, groupId]);

  const rangeConflicts = useMemo(() => {
    if (!rangeStart) return [];
    return props.conflicts.filter(
      (c) => !c.date || (c.date >= rangeStart && c.date <= rangeEnd),
    );
  }, [props.conflicts, rangeStart, rangeEnd]);

  const projectedDaysInRange = useMemo(() => {
    if (!rangeStart) return [];
    const end = rangeEnd || rangeStart;
    return model.projectedDays.filter((d) => d.date >= rangeStart && d.date <= end);
  }, [model.projectedDays, rangeStart, rangeEnd]);

  const hasPaint = useMemo(() => {
    if (!rangeStart) return false;
    const end = rangeEnd || rangeStart;
    for (const iso of enumerateDates(rangeStart, end)) {
      const projected = model.projectedDays.find((d) => d.date === iso);
      if (!projected) continue;
      const half = halfForDateInSelection(selection, iso);
      const city = locationLabelForSelectedHalf(projectedToDayPlace(projected), half);
      if (city.trim()) return true;
    }
    return false;
  }, [selection, model.projectedDays, rangeStart, rangeEnd]);

  const hasStay = Boolean(
    rangeStart && stayLinkedToHalfAwareSelection(groupStays, selection),
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
    return stayLinkedToHalfAwareSelection(groupStays, selection);
  }, [groupStays, rangeStart, rangeEnd, selection]);

  const dayCount = overviewDays.length;
  const isMultiDayRange = Boolean(rangeStart) && rangeStart !== rangeEnd;
  const legsForSelectedDay = useMemo(
    () => (rangeStart ? legsOnDate(props.graph, rangeStart) : []),
    [props.graph, rangeStart],
  );
  const isFullSingleDay =
    Boolean(rangeStart) && dayCount === 1 && rangeStart === rangeEnd && selectedHalf === "full";
  const splitTravelDay =
    isFullSingleDay &&
    rangeStart &&
    isSplitTravelDay(projectedInRange[0], rangeStart, legsForSelectedDay);

  const anchorDay = projectedDaysInRange.find((d) => d.date === rangeStart);
  const locationSummary = splitTravelDay
    ? splitDayLocationSummary(projectedInRange[0]) ??
      rangeLocationSummaryHalfAware(projectedDaysInRange, selection)
    : rangeLocationSummaryHalfAware(projectedDaysInRange, selection);
  const accommodationSummary = splitTravelDay && rangeStart
    ? splitDayAccommodationSummary(groupStays, rangeStart) ??
      rangeAccommodationSummaryHalfAware(selection, groupStays)
    : rangeAccommodationSummaryHalfAware(selection, groupStays);
  const transportSummary =
    splitTravelDay && legsInRange.length === 0
      ? "How are you getting there?"
      : legsInRange.length
        ? legsInRange.map((leg) => legRouteLabel(leg)).join(" · ")
        : "No legs in this range";

  const daysForConflictCheck = useMemo(() => {
    if (!rangeStart) return [];
    return overviewDays.map((row) =>
      row.projected
        ? projectedToDayPlace(row.projected)
        : {
            date: row.date,
            primaryCity: "",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip" as const,
            includeBuffer: false,
          },
    );
  }, [overviewDays, rangeStart]);

  const stayLocationConflicts = useMemo(() => {
    if (!stayDraft || !rangeStart) return [];
    const city = stayDraftCityLabel(stayDraft);
    if (!city) return [];
    return detectAccommodationLocationConflicts(
      selection,
      daysForConflictCheck,
      city,
      groupStays,
    );
  }, [selection, daysForConflictCheck, stayDraft, groupStays, rangeStart]);

  const keepStayCitySuggestion = useMemo(() => {
    if (!stayDraft) return null;
    return suggestKeepStayCityLabel({
      hotelName: stayDraft.name,
      effectiveCity: stayDraftCityLabel(stayDraft),
    });
  }, [stayDraft]);

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
      const dates = isMultiDayRange
        ? stayDatesForRangeApply(selection)
        : linkedStay
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
  }, [editingField, projectedInRange, linkedStay, selection, rangeStart, rangeEnd, legsForSelectedDay, isMultiDayRange]);

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

  async function commitStaySave(cityLabel: string, mergedDates: { checkIn: string; checkOut: string }) {
    if (!stayDraft) return;
    const isReplacingStay = Boolean(
      linkedStay &&
        (linkedStay.name?.trim() !== stayDraft.name.trim() ||
          !locationsMatch(stayCityLabel(linkedStay), cityLabel)),
    );
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
    if (needsLocationPaint && cityLabel && !isReplacingStay) {
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
    if (isReplacingStay && linkedStay) {
      commands.push({ type: "removeStay", groupId, stayId: linkedStay.id });
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
    } else if (stayDraft.id) {
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
    if (ok) {
      setStayConflictDialog(null);
      setEditingField(null);
    } else {
      setActionError(props.error || "Could not save stay.");
    }
  }

  async function saveStay() {
    setActionError(null);
    if (!stayDraft?.name.trim() || !stayDraft.checkIn || !stayDraft.checkOut) {
      setActionError("Hotel name and check-in/out dates are required.");
      return;
    }
    const mergedDates = isMultiDayRange
      ? stayDatesForRangeApply(selection)
      : stayDatesForSelection(selection, {
          checkIn: stayDraft.checkIn,
          checkOut: stayDraft.checkOut,
        });
    if (mergedDates.checkOut <= mergedDates.checkIn) {
      setActionError("Check-out must be after check-in.");
      return;
    }
    const cityLabel = stayDraftCityLabel(stayDraft);
    const conflicts = detectAccommodationLocationConflicts(
      selection,
      daysForConflictCheck,
      cityLabel,
      groupStays,
    );
    if (conflicts.length) {
      setStayConflictDialog({ cityLabel, conflicts });
      return;
    }
    await commitStaySave(cityLabel, mergedDates);
  }

  async function confirmStaySaveWithConflicts() {
    if (!stayDraft || !stayConflictDialog) return;
    const mergedDates = isMultiDayRange
      ? stayDatesForRangeApply(selection)
      : stayDatesForSelection(selection, {
          checkIn: stayDraft.checkIn,
          checkOut: stayDraft.checkOut,
        });
    await commitStaySave(stayConflictDialog.cityLabel, mergedDates);
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
      { type: "clearDayRange", groupId, rangeStart, rangeEnd, startHalf, endHalf },
    ]);
    props.onClearSelection();
  }

  const dayTitle = rangeStart
    ? isSingleHalfDay
      ? DateTime.fromISO(rangeStart).toFormat("d MMM yyyy")
      : rangeStart === rangeEnd
        ? DateTime.fromISO(rangeStart).toFormat("d MMM yyyy")
        : formatRangeDisplay(rangeStart, rangeEnd)
    : "";

  const daySubtitle = isSingleHalfDay
    ? `${selectedHalf === "left" ? "First half" : "Second half"} of the day`
    : splitTravelDay
      ? "Travel day — both halves shown"
      : dayCount > 1
        ? `${dayCount} days selected`
        : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-violet-600">Day overview</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{dayTitle}</h2>
          {daySubtitle ? <p className="mt-2 text-sm text-zinc-500">{daySubtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={props.onClearSelection}
          className="shrink-0 text-sm font-medium text-zinc-500 hover:text-zinc-800"
        >
          Dismiss
        </button>
      </div>

      {props.error || actionError ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {actionError || props.error}
        </p>
      ) : null}

      {rangeConflicts.length ? (
        <ul className="space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {rangeConflicts.map((c) => (
            <li key={c.id}>{c.message}</li>
          ))}
        </ul>
      ) : null}

      <section>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
          On this day
        </h3>
        <ul className="space-y-3">
          <OverviewLine
            label="Location"
            value={locationSummary}
            action={hasPaint ? "Edit" : "Add"}
            highlight={!hasPaint}
            onAction={() => setEditingField("location")}
          />
          <OverviewLine
            label="Stay"
            value={accommodationSummary}
            action={hasStay ? "Edit" : "Add"}
            highlight={!hasStay && accommodationSummary === "No hotel in this range"}
            onAction={() => setEditingField("accommodation")}
          />
          <OverviewLine
            label="Transport"
            value={transportSummary}
            action={legsInRange.length ? "Edit" : "Add"}
            highlight={Boolean(splitTravelDay && legsInRange.length === 0)}
            onAction={() => setEditingField("transport")}
          />
        </ul>
      </section>

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
              className="rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
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
                  city: resolveStayCityOnHotelPick({
                    hotelName: name,
                    mapsCityLabel: cityLabel,
                    address,
                    existingCity: stayDraft.city,
                  }),
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
            {stayLocationConflicts.length ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
                <p className="font-medium">
                  This stay city differs from locations already set on some selected days.
                </p>
                <ul className="mt-2 space-y-1">
                  {stayLocationConflicts.map((conflict) => (
                    <li key={`${conflict.rangeStart}-${conflict.existingLocation}-${conflict.existingAccommodation ?? ""}`}>
                      <span className="font-medium">
                        {formatRangeDisplay(conflict.rangeStart, conflict.rangeEnd)}
                      </span>
                      : {conflict.existingLocation}
                      {conflict.existingAccommodation?.trim()
                        ? ` · ${conflict.existingAccommodation.trim()}`
                        : null}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-amber-900">
                  Applying will replace location labels on the selected days with{" "}
                  <span className="font-medium">{stayDraftCityLabel(stayDraft)}</span>.
                </p>
                {keepStayCitySuggestion ? (
                  <button
                    type="button"
                    onClick={() =>
                      setStayDraft({ ...stayDraft, city: keepStayCitySuggestion })
                    }
                    className="mt-2 font-medium text-violet-800 hover:underline"
                  >
                    Keep as {keepStayCitySuggestion}?
                  </button>
                ) : null}
              </div>
            ) : null}
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
                className="rounded-full bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
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
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2 shadow-sm"
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

      {rangeStart ? (
        <DayOverviewActivities
          graph={graph}
          groupId={groupId}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          saving={props.saving}
          onDispatch={props.onDispatch}
        />
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

      <AccommodationLocationConflictDialog
        open={Boolean(stayConflictDialog)}
        stayCity={stayConflictDialog?.cityLabel ?? stayDraft?.city ?? ""}
        stayName={stayDraft?.name}
        keepCityLabel={keepStayCitySuggestion}
        conflicts={stayConflictDialog?.conflicts ?? []}
        saving={props.saving}
        formatRange={formatRangeDisplay}
        onCancel={() => setStayConflictDialog(null)}
        onConfirm={() => void confirmStaySaveWithConflicts()}
        onCityChange={(city) => {
          if (!stayDraft) return;
          const nextDraft = { ...stayDraft, city };
          setStayDraft(nextDraft);
          const cityLabel = stayDraftCityLabel(nextDraft);
          const conflicts = detectAccommodationLocationConflicts(
            selection,
            daysForConflictCheck,
            cityLabel,
            groupStays,
          );
          setStayConflictDialog({ cityLabel, conflicts });
        }}
      />
    </div>
  );
}

function OverviewLine(props: {
  label: string;
  value: string;
  action: string;
  highlight?: boolean;
  onAction: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={props.onAction}
        className="group flex w-full gap-4 text-left text-sm"
      >
        <span className="w-24 shrink-0 font-medium text-zinc-400">{props.label}</span>
        <span
          className={[
            "min-w-0 flex-1",
            props.highlight ? "font-medium text-amber-900" : "text-zinc-800",
          ].join(" ")}
        >
          {props.value}
        </span>
        <span className="shrink-0 font-medium text-violet-600 transition group-hover:text-violet-700">
          {props.action}
          <span className="ml-1 text-zinc-300 transition group-hover:text-violet-400">→</span>
        </span>
      </button>
    </li>
  );
}

function SectionEditorPanel(props: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-5 text-sm shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-800">
          {props.label}
        </p>
        <button
          type="button"
          onClick={props.onClose}
          className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
        >
          Close
        </button>
      </div>
      <div className="space-y-2">{props.children}</div>
    </div>
  );
}
