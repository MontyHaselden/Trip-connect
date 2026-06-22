"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DateTime } from "luxon";

import { HotelNamePicker } from "@/components/geo/HotelNamePicker";
import { PlacePicker } from "@/components/geo/PlacePicker";
import {
  accommodationSearchMode,
  inferCityLabelFromAddress,
  looksLikeFormalMapsCityLabel,
  resolveStayCityOnHotelPick,
  suggestKeepStayCityLabel,
} from "@/lib/geo/accommodation-search";
import {
  defaultHomestayGroupForType,
  PICKABLE_STAY_TYPES,
  stayTypeLabel,
} from "@/lib/host/accommodation/stay-type-labels";
import {
  homestayFamilyStays,
  homestayPeriodStays,
} from "@/lib/host/accommodation/homestay-helpers";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import {
  accommodationCityForSelection,
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
  StayType,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import type {
  CalendarRenderModel,
  EngineConflict,
  ProjectedDay,
  RosterSummary,
  TripEntityGraph,
} from "@/lib/trip-engine/types";
import { newId } from "@/lib/host/wizard/types";

import { daysInSelection, type CalendarSelection } from "../calendar/useCalendarSelection";
import { AsyncButton } from "../shared/AsyncButton";
import { AccommodationLocationConflictDialog } from "./AccommodationLocationConflictDialog";
import { DayOverviewActivities } from "./DayOverviewActivities";
import { AddHomestaysModal } from "../homestay/AddHomestaysModal";
import { FlightLegQuickForm } from "../shared/FlightLegQuickForm";
import { tripFieldClass, TripInput } from "../shared/TripInput";
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
  const normalized = meaningful.map((label) =>
    shortCityName(label.replace(/\s*\(\d+%\)\s*$/, "")),
  );
  const unique = [...new Set(normalized.filter(Boolean))];
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
  return "No stay in this range";
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
  return `${label} (half day)`;
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
  tripId: string;
  graph: TripEntityGraph;
  groupId: string;
  model: CalendarRenderModel;
  selection: CalendarSelection;
  conflicts: EngineConflict[];
  rosterSummary?: RosterSummary;
  saving?: boolean;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onClearSelection: () => void;
  onReload?: () => void;
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
    googlePlaceId: string | null;
    latitude: number | null;
    longitude: number | null;
    checkIn: string;
    checkOut: string;
    stayType: StayType;
    isHomestayGroup: boolean;
  } | null>(null);
  const [stayConflictDialog, setStayConflictDialog] = useState<{
    cityLabel: string;
    conflicts: AccommodationLocationConflict[];
  } | null>(null);
  const [homestaysModalOpen, setHomestaysModalOpen] = useState(false);
  const [homestaysModalContext, setHomestaysModalContext] = useState<{
    cityLabel: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);

  const groupStays = useMemo(() => staysForGroup(graph, groupId), [graph, groupId]);

  const homestayPeriodInRange = useMemo(() => {
    if (!rangeStart) return null;
    const end = rangeEnd || rangeStart;
    return (
      homestayPeriodStays(groupStays).find(
        (s) => s.checkInDate <= end && s.checkOutDate > rangeStart,
      ) ?? null
    );
  }, [groupStays, rangeStart, rangeEnd]);

  const homestayFamiliesInRange = useMemo(() => {
    if (!rangeStart) return [];
    const end = rangeEnd || rangeStart;
    return homestayFamilyStays(groupStays).filter(
      (s) => s.checkInDate <= end && s.checkOutDate > rangeStart,
    );
  }, [groupStays, rangeStart, rangeEnd]);

  const homestayStudents = useMemo(
    () => (props.rosterSummary?.participants ?? []).filter((p) => p.role === "student"),
    [props.rosterSummary?.participants],
  );

  const isGroupHomestayDraft =
    stayDraft?.stayType === "homestay" && Boolean(stayDraft.isHomestayGroup);

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
          : accommodationCityForSelection(selection, daysForConflictCheck);
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
        googlePlaceId: linkedStay?.googlePlaceId ?? null,
        latitude: linkedStay?.latitude ?? null,
        longitude: linkedStay?.longitude ?? null,
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        stayType: linkedStay?.stayType ?? "hotel",
        isHomestayGroup: linkedStay?.isHomestayGroup ?? false,
      });
    }
  }, [editingField, projectedInRange, linkedStay, selection, rangeStart, rangeEnd, legsForSelectedDay, isMultiDayRange, daysForConflictCheck]);

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

  function saveLocation() {
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
      void props.onDispatch([{ type: "setDayPlaces", groupId, days }]);
      setEditingField(null);
      return;
    }

    if (!locationDraft.trim()) {
      setActionError("Enter a city or region.");
      return;
    }
    void props.onDispatch([
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
    setEditingField(null);
  }

  async function commitStaySave(
    cityLabel: string,
    mergedDates: { checkIn: string; checkOut: string },
    options?: { replaceLocationLabels?: boolean },
  ) {
    if (!stayDraft) return;
    const isReplacingStay = Boolean(
      linkedStay &&
        (linkedStay.name?.trim() !== stayDraft.name.trim() ||
          !locationsMatch(stayCityLabel(linkedStay), cityLabel)),
    );
    const isGroupHomestayPeriod =
      stayDraft.stayType === "homestay" && stayDraft.isHomestayGroup;
    const payload = {
      name: isGroupHomestayPeriod
        ? stayDraft.name.trim() || `Homestays · ${cityLabel}`
        : stayDraft.name.trim(),
      cityLabel,
      address: stayDraft.address,
      googlePlaceId: stayDraft.googlePlaceId,
      latitude: stayDraft.latitude,
      longitude: stayDraft.longitude,
      checkInDate: mergedDates.checkIn,
      checkOutDate: mergedDates.checkOut,
      stayType: stayDraft.stayType,
      isHomestayGroup: stayDraft.isHomestayGroup,
      multipleInCity: stayDraft.stayType === "homestay" && stayDraft.isHomestayGroup,
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
      const checkInProjected = projectedInRange.find((d) => d.date === rangeStart);
      const checkInDepartureCity = checkInProjected?.primaryCity.trim() ?? "";
      const preserveTravelDayOnCheckIn = Boolean(
        startHalf === "right" &&
          rangeStart &&
          checkInDepartureCity &&
          !locationsMatch(checkInDepartureCity, cityLabel),
      );
      if ((splitTravelDay || preserveTravelDayOnCheckIn) && rangeStart) {
        const projected = checkInProjected ?? projectedInRange[0];
        const updatedDay = {
          date: rangeStart,
          primaryCity:
            projected?.primaryCity.trim() ||
            departureDraft.trim() ||
            graph.basics.departureCity,
          secondaryCity: cityLabel,
          primaryShare: projected?.primaryShare ?? 0.5,
          dayType: projected?.dayType ?? ("trip" as const),
          includeBuffer: false,
        };
        const existing = dayPlacesForGroup(graph, groupId);
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
        replaceLocationLabels: options?.replaceLocationLabels,
        stay: {
          id: newId(),
          url: null,
          phone: null,
          notes: null,
          ...payload,
        },
      });
    } else if (stayDraft.id) {
      commands.push({
        type: "updateStay",
        groupId,
        stayId: stayDraft.id,
        replaceLocationLabels: options?.replaceLocationLabels,
        patch: payload,
      });
    } else {
      commands.push({
        type: "addStay",
        groupId,
        replaceLocationLabels: options?.replaceLocationLabels,
        stay: {
          id: newId(),
          url: null,
          phone: null,
          notes: null,
          ...payload,
        },
      });
    }
    const ok = await props.onDispatch(commands);
    if (ok) {
      setStayConflictDialog(null);
      if (isGroupHomestayPeriod) {
        setHomestaysModalContext({
          cityLabel,
          checkIn: mergedDates.checkIn,
          checkOut: mergedDates.checkOut,
        });
        setHomestaysModalOpen(true);
        setEditingField(null);
      } else {
        setEditingField(null);
      }
    } else {
      setActionError(props.error || "Could not save stay.");
    }
  }

  async function saveStay() {
    setActionError(null);
    if (!stayDraft?.checkIn || !stayDraft.checkOut) {
      setActionError("Check-in and check-out dates are required.");
      return;
    }
    const isGroupHomestay =
      stayDraft.stayType === "homestay" && stayDraft.isHomestayGroup;
    if (!isGroupHomestay && !stayDraft.name.trim()) {
      setActionError("Property name and check-in/out dates are required.");
      return;
    }
    if (isGroupHomestay && !stayDraftCityLabel(stayDraft).trim()) {
      setActionError("Enter a stay city for the homestay period.");
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
    await commitStaySave(stayConflictDialog.cityLabel, mergedDates, {
      replaceLocationLabels: true,
    });
  }

  function removeStay() {
    if (!linkedStay) return;
    if (!window.confirm("Remove this stay?")) return;
    setEditingField(null);
    void props.onDispatch([
      { type: "removeStay", groupId, stayId: linkedStay.id },
    ]);
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

  function openHomestaysModal() {
    const cityLabel =
      (homestayPeriodInRange ? stayCityLabel(homestayPeriodInRange) : "") ||
      (stayDraft ? stayDraftCityLabel(stayDraft) : "") ||
      accommodationCityForSelection(selection, daysForConflictCheck);
    const checkIn =
      homestayPeriodInRange?.checkInDate ||
      stayDraft?.checkIn ||
      stayDatesForRangeApply(selection).checkIn;
    const checkOut =
      homestayPeriodInRange?.checkOutDate ||
      stayDraft?.checkOut ||
      stayDatesForRangeApply(selection).checkOut;
    setHomestaysModalContext({ cityLabel, checkIn, checkOut });
    setHomestaysModalOpen(true);
  }

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

      {groupId !== graph.mainGroupId ? (
        <p className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-relaxed text-violet-950">
          You&apos;re editing a participant or subgroup plan — not the whole group. Switch the
          calendar back to <span className="font-medium">Whole group</span> to edit the main trip.
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
            highlight={!hasStay && accommodationSummary === "No stay in this range"}
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

      {homestayPeriodInRange ? (
        <section className="rounded-2xl border border-zinc-200/80 bg-gradient-to-b from-violet-50/40 to-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
                Host families
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                {homestayPeriodInRange.name || "Homestays"} ·{" "}
                {homestayPeriodInRange.checkInDate} → {homestayPeriodInRange.checkOutDate}
              </p>
            </div>
            <button
              type="button"
              onClick={openHomestaysModal}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              Add homestays
            </button>
          </div>
          {homestayFamiliesInRange.length ? (
            <ul className="mt-4 space-y-2">
              {homestayFamiliesInRange.map((family) => (
                <li
                  key={family.id}
                  className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-sm"
                >
                  <p className="font-medium text-zinc-900">{family.name}</p>
                  {family.address ? (
                    <p className="mt-0.5 text-zinc-600">{family.address}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              No host families yet — add them to assign students.
            </p>
          )}
        </section>
      ) : null}

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
            <label className="block space-y-1.5">
              <span className="text-xs text-zinc-500">Type</span>
              <select
                value={stayDraft.stayType}
                onChange={(e) => {
                  const stayType = e.target.value as StayType;
                  setStayDraft({
                    ...stayDraft,
                    stayType,
                    isHomestayGroup: defaultHomestayGroupForType(stayType),
                  });
                }}
                className={inputClass}
              >
                {PICKABLE_STAY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {stayTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            {isGroupHomestayDraft ? (
              <>
                <label className="block space-y-1.5">
                  <span className="text-xs text-zinc-500">Period label (optional)</span>
                  <TripInput
                    value={stayDraft.name}
                    onChange={(e) => setStayDraft({ ...stayDraft, name: e.target.value })}
                    placeholder={`Homestays · ${stayDraft.city.trim() || "city"}`}
                    className={inputClass}
                  />
                </label>
                <div className="rounded-2xl border border-violet-200/70 bg-violet-50/50 px-4 py-4">
                  <p className="text-sm leading-relaxed text-zinc-700">
                    Save the homestay period on the calendar first. You&apos;ll then add each host
                    family and assign students in a quick popup.
                  </p>
                  {homestayPeriodInRange ? (
                    <button
                      type="button"
                      onClick={openHomestaysModal}
                      className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Add homestays
                    </button>
                  ) : null}
                  {homestayFamiliesInRange.length ? (
                    <ul className="mt-3 space-y-1.5 border-t border-violet-200/60 pt-3">
                      {homestayFamiliesInRange.map((family) => (
                        <li key={family.id} className="text-sm text-zinc-800">
                          <span className="font-medium">{family.name}</span>
                          {family.address ? (
                            <span className="text-zinc-500"> · {family.address}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs text-zinc-500">
                  {accommodationSearchMode(stayDraft.stayType).fieldLabel}
                </span>
                <HotelNamePicker
                  value={stayDraft.name}
                  onChange={(name) => setStayDraft({ ...stayDraft, name })}
                  onSelectHotel={({ name, address, cityLabel, placeId, lat, lng }) => {
                    setStayDraft({
                      ...stayDraft,
                      name,
                      address: address || null,
                      googlePlaceId: placeId ?? null,
                      latitude: lat ?? null,
                      longitude: lng ?? null,
                      city: resolveStayCityOnHotelPick({
                        hotelName: name,
                        mapsCityLabel: cityLabel,
                        address,
                        existingCity: stayDraft.city,
                      }),
                    });
                  }}
                  stayType={stayDraft.stayType}
                  countryNames={props.graph.basics.destinationCountries ?? []}
                  stayCity={stayDraftCityLabel(stayDraft) || undefined}
                  placeholder={accommodationSearchMode(stayDraft.stayType).placeholder}
                  inputClassName={inputClass}
                />
              </label>
            )}
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
            {stayDraft.stayType === "homestay" ? (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={stayDraft.isHomestayGroup}
                  onChange={(e) =>
                    setStayDraft({ ...stayDraft, isHomestayGroup: e.target.checked })
                  }
                  className="rounded border-zinc-300"
                />
                Each student stays with a different host family
              </label>
            ) : null}
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

      <AddHomestaysModal
        open={homestaysModalOpen}
        onClose={() => {
          setHomestaysModalOpen(false);
          setHomestaysModalContext(null);
        }}
        tripId={props.tripId}
        groupId={groupId}
        cityLabel={homestaysModalContext?.cityLabel ?? ""}
        checkIn={homestaysModalContext?.checkIn ?? ""}
        checkOut={homestaysModalContext?.checkOut ?? ""}
        students={homestayStudents}
        onDispatch={props.onDispatch}
        onSaved={() => props.onReload?.()}
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
