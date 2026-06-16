"use client";

import { DateTime } from "luxon";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AccommodationStayForm } from "@/components/host/wizard/shared/AccommodationStayForm";
import { TransportLegForm } from "@/components/host/wizard/shared/TransportLegForm";
import {
  applyStaysToDayPlaces,
  coalesceAdjacentNamedStays,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { inferDayPlacesFromStay } from "@/lib/host/setup-inference";
import { dedupeCityChangeLegs } from "@/lib/host/setup/dedupe-intercity-legs";
import {
  expandSelectionToNightPair,
  formatNightPairLabel,
} from "@/lib/host/setup/night-pair-selection";
import { resolvedMainDayPlaces } from "@/lib/host/setup/resolved-day-places";
import {
  dayPlacesFromStays,
  extendNamedStayToRange,
} from "@/lib/host/setup/sync-stay-locations";
import { activitiesAttachedToStay } from "@/lib/host/setup/accommodation-activities";
import {
  accommodationLocationConflict,
  currentAccommodationLocationLabel,
  type DayLocationChoice,
} from "@/lib/host/setup/accommodation-location-prompt";
import { applySetupAccommodationChange } from "@/lib/host/setup/apply-setup-accommodation";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import {
  mergeAccommodationStays,
  mainAccommodationStays,
  mainIntercityLegs,
} from "@/lib/host/setup/entity-scope";
import { clearEverythingFromDay } from "@/lib/host/setup/clear-day-content";
import { removeAccommodationAndCitiesFromRange } from "@/lib/host/setup/remove-accommodation-range";
import { transferCityCode } from "@/lib/host/setup/transport-corridor";
import {
  selectionNeedsSetup,
  stayCoversNight,
  stayRelevantToSelection,
  staySelectionSpan,
} from "@/lib/host/setup/day-selection-setup";
import {
  chainedTransportLeg,
  connectionLegHint,
  firstOutboundLeg,
  firstReturnLeg,
  legRouteLabel,
  outboundLegTitle,
  returnLegTitle,
} from "@/lib/host/wizard/leg-chain";
import { formatTimeDisplay } from "@/lib/utils/time-input";
import {
  cityOnHalf,
  enumerateDates,
  isHalfEmpty,
  isSplitDay,
  locationsMatch,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import { legTouchesRange } from "@/lib/host/wizard/transport-leg-dates";
import { newId } from "@/lib/host/wizard/types";
import type {
  AccommodationStayDraft,
  IntercityLegDraft,
  TransportLegDraft,
  TripWizardDraft,
} from "@/lib/host/wizard/types";
import type { TripSetupState } from "@/lib/host/setup/types";
import { removeStayFromState } from "@/lib/trip-engine/client-commands";

import { AccommodationActivitiesModal } from "./AccommodationActivitiesModal";
import { AccommodationLocationModal } from "./AccommodationLocationModal";
import { SetupDayAddsPanel } from "./SetupDayAddsPanel";
import type { CalendarSelection } from "./use-setup-calendar";

type WorkspaceTab = "overview" | "accommodation" | "transport" | "activities";

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "accommodation", label: "Accommodation" },
  { id: "transport", label: "Transport" },
  { id: "activities", label: "Activities" },
];

function OverviewSection(props: {
  title: string;
  empty: boolean;
  emptyLabel: string;
  onAdd: () => void;
  showAdd?: boolean;
  children?: ReactNode;
}) {
  const { title, empty, emptyLabel, onAdd, showAdd = empty, children } = props;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {showAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-lg font-medium text-zinc-600 hover:bg-zinc-50"
            aria-label={`Add ${title.toLowerCase()}`}
          >
            +
          </button>
        ) : null}
      </div>
      {empty ? (
        <p className="mt-2 text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">{children}</div>
      )}
    </div>
  );
}

function inRange(date: string, start: string, end: string): boolean {
  const e = end || start;
  return date >= start && date <= e;
}

function addDays(iso: string, delta: number): string {
  return DateTime.fromISO(iso).plus({ days: delta }).toISODate()!;
}

function departureCityForSelection(
  day: TripWizardDraft["dayPlaces"][number] | undefined,
  selectedHalf: HalfSide | "full",
  homeCity: string,
): string {
  if (!day) return homeCity;
  if (selectedHalf === "left") {
    return cityOnHalf(day, "left").trim() || homeCity;
  }
  if (selectedHalf === "right") {
    if (isHalfEmpty(day, "right")) {
      return cityOnHalf(day, "left").trim() || homeCity;
    }
    return cityOnHalf(day, "right").trim() || homeCity;
  }
  return day.primaryCity.trim() || day.secondaryCity?.trim() || homeCity;
}

function syncMainDayPlaces(
  state: TripSetupState,
  dayPlaces: TripWizardDraft["dayPlaces"],
): TripSetupState {
  return {
    ...state,
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [state.mainGroupId]: dayPlaces,
    },
  };
}

function stayTitle(stay: AccommodationStayDraft): string {
  return stay.name?.trim() || stayCityLabel(stay) || "Accommodation";
}

export function SetupDayContextPanel(props: {
  state: TripSetupState;
  selection: CalendarSelection;
  corridorFocusDate?: string | null;
  onSelectionChange?: (
    iso: string,
    half: HalfSide | "full",
    focusTab?: CalendarSelection["focusTab"],
  ) => void;
  onChange: (next: TripSetupState) => void;
  onDismiss: () => void;
  onSave: (next: TripSetupState) => void | Promise<void>;
  /** Clear selection after inline confirms that do not persist (e.g. add activity). */
  onConfirmed?: () => void;
  onFlightScheduled?: (travelDate: string) => void;
  saving: boolean;
  inviteCode: string;
}) {
  const {
    state,
    selection,
    corridorFocusDate,
    onSelectionChange,
    onChange,
    onDismiss,
    onSave,
    onConfirmed,
    onFlightScheduled,
    saving,
    inviteCode,
  } = props;
  const expandedSelection = useMemo(
    () => expandSelectionToNightPair(selection),
    [selection],
  );
  const { rangeStart, rangeEnd, startHalf, endHalf } = expandedSelection;
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [roster, setRoster] = useState<{
    groups: Array<{ id: string; name: string }>;
    participants: Array<{ id: string; fullName: string }>;
    rooms: Array<{ id: string; roomName: string }>;
  }>({ groups: [], participants: [], rooms: [] });

  const [draftStay, setDraftStay] = useState<AccommodationStayDraft | null>(null);
  const [editingStay, setEditingStay] = useState<AccommodationStayDraft | null>(null);
  const [activitiesModalOpen, setActivitiesModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [locationConflict, setLocationConflict] = useState<{
    current: string;
    proposed: string;
  } | null>(null);
  const [locationDraft, setLocationDraft] = useState("");
  const [pendingStay, setPendingStay] = useState<AccommodationStayDraft | null>(null);
  const [pendingIsNew, setPendingIsNew] = useState(false);
  const [pendingLocationChoice, setPendingLocationChoice] = useState<DayLocationChoice>({
    mode: "apply",
  });
  const [locationEdit, setLocationEdit] = useState("");

  useEffect(() => {
    void fetch(`/api/host/${encodeURIComponent(inviteCode)}/roster`)
      .then((r) => r.json())
      .then((body) => {
        setRoster({
          groups: body.groups ?? [],
          participants: body.participants ?? [],
          rooms: body.rooms ?? [],
        });
      })
      .catch(() => undefined);
  }, [inviteCode]);

  const end = rangeEnd || rangeStart || "";
  const hasSelection = Boolean(rangeStart);

  const selectedHalf = rangeStart === end ? startHalf : "full";
  const rangeLabel = hasSelection ? formatNightPairLabel(expandedSelection) : "";

  const resolvedDays = useMemo(() => resolvedMainDayPlaces(state), [state]);

  const daysInRange = useMemo(
    () => (rangeStart ? resolvedDays.filter((d) => inRange(d.date, rangeStart, end)) : []),
    [resolvedDays, rangeStart, end],
  );

  const day = rangeStart ? daysInRange.find((d) => d.date === rangeStart) : undefined;

  const selectedHalfEmpty = Boolean(
    day && selectedHalf !== "full" && isHalfEmpty(day, selectedHalf),
  );

  const locationLabel = useMemo(() => {
    if (day && selectedHalf !== "full") {
      if (selectedHalfEmpty) return "";
      return cityOnHalf(day, selectedHalf);
    }
    const labels = new Set<string>();
    for (const d of daysInRange) {
      const primary = d.primaryCity.trim();
      const secondary = d.secondaryCity?.trim() ?? "";
      if (primary) labels.add(primary);
      if (secondary) labels.add(secondary);
    }
    const cities = [...labels];
    if (cities.length === 1) return cities[0]!;
    if (cities.length > 1) return cities.join(" → ");
    return "";
  }, [daysInRange, day, selectedHalf, selectedHalfEmpty]);
  const cityForRange = locationLabel || "TBC";

  const legsOnRange = useMemo(() => {
    if (!rangeStart) return [];
    const all: Array<{ kind: "outbound" | "return" | "intercity"; index: number; leg: TransportLegDraft }> =
      [];
    state.outboundLegs.forEach((leg, index) => {
      if (legTouchesRange(leg, rangeStart, end)) all.push({ kind: "outbound", index, leg });
    });
    state.returnLegs.forEach((leg, index) => {
      if (legTouchesRange(leg, rangeStart, end)) all.push({ kind: "return", index, leg });
    });
    state.intercityLegs.forEach((leg, index) => {
      if (legTouchesRange(leg, rangeStart, end)) all.push({ kind: "intercity", index, leg });
    });
    return all;
  }, [state, rangeStart, end]);

  const staysOnRange = useMemo(() => {
    if (!rangeStart) return [];
    return mainAccommodationStays(state).filter(
      (s) => s.checkInDate <= end && s.checkOutDate > rangeStart,
    );
  }, [state, rangeStart, end]);

  const namedStaysOnRange = useMemo(
    () => staysOnRange.filter((s) => s.name?.trim()),
    [staysOnRange],
  );

  const staysForSelection = useMemo(() => {
    if (!rangeStart) return [];
    return mainAccommodationStays(state).filter((s) =>
      stayRelevantToSelection(s, rangeStart, end),
    );
  }, [state, rangeStart, end]);

  const selectionNightsWithAccommodation = useMemo(() => {
    if (!rangeStart) return 0;
    const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
    return enumerateDates(rangeStart, end).filter((iso) =>
      named.some((s) => stayCoversNight(s, iso)),
    ).length;
  }, [state, rangeStart, end]);

  const selectionNightCount = rangeStart ? enumerateDates(rangeStart, end).length : 0;
  const hasAccommodationGaps =
    selectionNightsWithAccommodation > 0 &&
    selectionNightsWithAccommodation < selectionNightCount;
  const accommodationEmptyForSelection = selectionNightsWithAccommodation === 0;

  const primaryStay = useMemo(() => {
    if (!rangeStart || selectedHalfEmpty) return undefined;
    const named = staysForSelection.filter((s) => s.name?.trim());
    return (
      named.find((s) => {
        let cursor = rangeStart;
        while (cursor <= end) {
          if (!stayCoversNight(s, cursor)) return false;
          cursor = addDays(cursor, 1);
        }
        return true;
      }) ??
      named.find((s) => stayCoversNight(s, rangeStart)) ??
      undefined
    );
  }, [staysForSelection, rangeStart, end, selectedHalfEmpty]);

  const { needsLocation, needsAccommodation } = useMemo(
    () =>
      rangeStart
        ? selectionNeedsSetup(
            rangeStart,
            end,
            selectedHalf,
            daysInRange,
            namedStaysOnRange,
          )
        : { needsLocation: false, needsAccommodation: false },
    [rangeStart, end, selectedHalf, daysInRange, namedStaysOnRange],
  );
  const needsAccommodationSetup = needsLocation || needsAccommodation;

  const activitiesOnRange = useMemo(() => {
    if (!rangeStart) return [];
    return state.activities
      .filter((a) => inRange(a.date, rangeStart, end))
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        if (!a.startTime && !b.startTime) return a.title.localeCompare(b.title);
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [state.activities, rangeStart, end]);

  const intercityLegsOnRange = useMemo(
    () => legsOnRange.filter((entry) => entry.kind === "intercity"),
    [legsOnRange],
  );

  const corridorHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!corridorFocusDate) {
      corridorHandledRef.current = null;
      return;
    }
    if (corridorFocusDate !== rangeStart) return;
    if (corridorHandledRef.current === corridorFocusDate) return;

    const crossoverDay = resolvedDays.find((d) => d.date === corridorFocusDate);
    const fromCity = crossoverDay?.primaryCity.trim() ?? "";
    const toCity = crossoverDay?.secondaryCity?.trim() ?? "";
    if (!fromCity || !toCity) return;

    corridorHandledRef.current = corridorFocusDate;
    setTab("transport");

    const existing = state.intercityLegs.find(
      (leg) =>
        leg.travelDate === corridorFocusDate &&
        leg.intercityFromCity.trim().toLowerCase() === fromCity.toLowerCase() &&
        leg.intercityToCity.trim().toLowerCase() === toCity.toLowerCase(),
    );
    if (existing) return;

    const leg: IntercityLegDraft = {
      id: newId(),
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: corridorFocusDate,
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      fromCity,
      toCity,
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
      intercityFromCity: fromCity,
      intercityToCity: toCity,
      originGroupId: state.mainGroupId,
    };
    applyWithTransportInference({ ...state, intercityLegs: [...state.intercityLegs, leg] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per corridor click
  }, [corridorFocusDate, rangeStart, resolvedDays]);

  useEffect(() => {
    if (corridorFocusDate && corridorFocusDate === rangeStart) {
      setTab("transport");
    } else {
      setTab(selection.focusTab === "transport" ? "transport" : "overview");
    }
    setEditingStay(null);
    setDraftStay(null);
    setPendingStay(null);
    setActivitiesModalOpen(false);
    setLocationModalOpen(false);
    setLocationConflict(null);
    setPendingLocationChoice({ mode: "apply" });
  }, [rangeStart, end, startHalf, selection.focusTab, corridorFocusDate]);

  useEffect(() => {
    setLocationEdit(locationLabel);
  }, [locationLabel, rangeStart, end, startHalf]);

  useEffect(() => {
    if (!rangeStart || tab !== "accommodation" || editingStay || draftStay) return;
    if (primaryStay && !needsAccommodationSetup) return;
    setDraftStay({
      id: newId(),
      cityLabel: cityForRange,
      stayType: "hotel",
      name: null,
      url: null,
      address: null,
      phone: null,
      checkInDate: rangeStart,
      checkOutDate: addDays(end, 1),
      notes: null,
      isHomestayGroup: false,
      multipleInCity: false,
      originGroupId: state.mainGroupId,
    });
  }, [
    tab,
    rangeStart,
    end,
    cityForRange,
    state.mainGroupId,
    needsAccommodationSetup,
    editingStay,
    draftStay,
    primaryStay,
  ]);

  function applyWithTransportInference(next: TripSetupState) {
    onChange(
      applySetupTransportChange(next, {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        intercityLegs: next.intercityLegs,
      }),
    );
  }

  function addFlightLeg() {
    const fromCity = departureCityForSelection(day, selectedHalf, state.basics.departureCity);
    const leg: TransportLegDraft = {
      id: newId(),
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: "",
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      fromCity,
      toCity: "",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
    };

    let next = { ...state };
    if (rangeStart === state.basics.startDate && !state.outboundLegs.length) {
      next = {
        ...next,
        outboundLegs: [{ ...leg, fromCity: state.basics.departureCity || fromCity }],
      };
    } else if (rangeStart === state.basics.endDate && !state.returnLegs.length) {
      next = {
        ...next,
        returnLegs: [
          {
            ...leg,
            fromCity,
            toCity: state.basics.returnCity,
          },
        ],
      };
    } else {
      const intercity: IntercityLegDraft = {
        ...leg,
        intercityFromCity: fromCity,
        intercityToCity: "",
        originGroupId: state.mainGroupId,
      };
      next = { ...next, intercityLegs: [...next.intercityLegs, intercity] };
    }
    setTab("transport");
    applyWithTransportInference(next);
  }

  function addExtraLeg() {
    if (!rangeStart) return;

    const outboundOnRange = legsOnRange.filter((entry) => entry.kind === "outbound");
    const returnOnRange = legsOnRange.filter((entry) => entry.kind === "return");

    if (outboundOnRange.length > 0) {
      addOutboundConnection();
      return;
    }
    if (returnOnRange.length > 0) {
      addReturnConnection();
      return;
    }
    if (intercityLegsOnRange.length > 0) {
      const last = intercityLegsOnRange[intercityLegsOnRange.length - 1]!.leg as IntercityLegDraft;
      const leg: IntercityLegDraft = {
        ...chainedTransportLeg(last),
        intercityFromCity: last.intercityToCity.trim() || last.toCity.trim(),
        intercityToCity: "",
        originGroupId: state.mainGroupId,
      };
      applyWithTransportInference({ ...state, intercityLegs: [...state.intercityLegs, leg] });
      return;
    }

    addFlightLeg();
  }

  function transportLegTitle(
    kind: "outbound" | "return" | "intercity",
    index: number,
  ): string {
    if (kind === "outbound") return outboundLegTitle(index);
    if (kind === "return") return returnLegTitle(index);
    const position = intercityLegsOnRange.findIndex((entry) => entry.index === index);
    return position <= 0 ? "Main leg" : `Extra leg ${position}`;
  }

  function addOutboundConnection() {
    const previous = state.outboundLegs[state.outboundLegs.length - 1];
    const leg =
      state.outboundLegs.length === 0
        ? firstOutboundLeg(
            state.basics.startDate,
            state.basics.departureCity,
            state.basics.defaultDepartureAirport,
          )
        : chainedTransportLeg(previous);
    setTab("transport");
    applyWithTransportInference({ ...state, outboundLegs: [...state.outboundLegs, leg] });
  }

  function addReturnConnection() {
    const previous = state.returnLegs[state.returnLegs.length - 1];
    const leg =
      state.returnLegs.length === 0
        ? firstReturnLeg(state.basics.endDate, state.basics.returnCity)
        : chainedTransportLeg(previous);
    setTab("transport");
    applyWithTransportInference({ ...state, returnLegs: [...state.returnLegs, leg] });
  }

  const hasNamedStayOnRange = staysForSelection.some((s) => s.name?.trim());

  function stayDatesForSelection(stay: AccommodationStayDraft): string {
    const span = staySelectionSpan(stay, rangeStart, end);
    if (!span) return `${stay.checkInDate} – ${stay.checkOutDate}`;
    const checkout = addDays(span.to, 1);
    return span.from === span.to
      ? `${span.from} (night)`
      : `${span.from} – ${checkout}`;
  }

  const transferRoute = useMemo(() => {
    const crossover =
      day?.primaryCity.trim() && day?.secondaryCity?.trim()
        ? { from: day.primaryCity.trim(), to: day.secondaryCity.trim() }
        : null;
    if (!crossover) return null;
    return {
      from: transferCityCode(crossover.from),
      to: transferCityCode(crossover.to),
    };
  }, [day]);

  function dedupeIntercityLegsForState(nextState: TripSetupState): IntercityLegDraft[] {
    const named = mainAccommodationStays(nextState).filter((s) => s.name?.trim());
    const dayPlaces = resolvedMainDayPlaces(nextState);
    return dedupeCityChangeLegs(nextState.intercityLegs, named, dayPlaces);
  }

  function handleClearLocation() {
    if (!rangeStart) return;
    if (
      !window.confirm(
        `Clear location and accommodation for this night (${rangeLabel})? Half-days are always cleared as a pair.`,
      )
    ) {
      return;
    }
    let next = removeAccommodationAndCitiesFromRange(
      state,
      rangeStart,
      end,
      state.mainGroupId,
      { startHalf, endHalf },
    );
    next = {
      ...next,
      intercityLegs: dedupeIntercityLegsForState(next),
    };
    next = applySetupTransportChange(next, { intercityLegs: next.intercityLegs });
    onChange(next);
    void onSave(next);
  }

  function handleClearEverythingFromDay() {
    if (!rangeStart) return;
    const targetDate = rangeStart === end ? rangeStart : rangeStart;
    if (
      !window.confirm(
        `Clear everything on ${targetDate}? This removes locations, accommodation, transport, and activities for that day.`,
      )
    ) {
      return;
    }
    const next = clearEverythingFromDay(state, targetDate, state.mainGroupId);
    onChange(next);
    void onSave(next);
  }

  function handleDeleteAccommodation() {
    if (!rangeStart) return;
    if (
      !window.confirm(
        `Delete accommodation and clear locations for this night (${rangeLabel})?`,
      )
    ) {
      return;
    }
    let next = removeAccommodationAndCitiesFromRange(
      state,
      rangeStart,
      end,
      state.mainGroupId,
      { startHalf, endHalf },
    );
    next = {
      ...next,
      intercityLegs: dedupeIntercityLegsForState(next),
    };
    next = applySetupTransportChange(next, { intercityLegs: next.intercityLegs });
    onChange(next);
    void onSave(next);
  }

  function handleDeleteStay(stay: AccommodationStayDraft) {
    if (
      !window.confirm(
        `Delete ${stayTitle(stay)}? This removes the stay and updates the calendar.`,
      )
    ) {
      return;
    }
    const next = removeStayFromState(state, stay.id);
    if (editingStay?.id === stay.id) setEditingStay(null);
    if (draftStay?.id === stay.id) setDraftStay(null);
    onChange(next);
    void onSave(next);
  }

  function removeLeg(kind: "outbound" | "return" | "intercity", index: number) {
    const next = { ...state };
    if (kind === "outbound") {
      next.outboundLegs = state.outboundLegs.filter((_, j) => j !== index);
    } else if (kind === "return") {
      next.returnLegs = state.returnLegs.filter((_, j) => j !== index);
    } else {
      next.intercityLegs = state.intercityLegs.filter((_, j) => j !== index);
    }
    applyWithTransportInference(next);
  }

  function updateLeg(
    kind: "outbound" | "return" | "intercity",
    index: number,
    leg: TransportLegDraft,
  ) {
    const next = { ...state };
    if (kind === "outbound") {
      const outboundLegs = [...next.outboundLegs];
      outboundLegs[index] = leg;
      next.outboundLegs = outboundLegs;
    } else if (kind === "return") {
      const returnLegs = [...next.returnLegs];
      returnLegs[index] = leg;
      next.returnLegs = returnLegs;
    } else {
      const intercityLegs = [...next.intercityLegs];
      const prev = intercityLegs[index] as IntercityLegDraft;
      intercityLegs[index] = {
        ...leg,
        intercityFromCity: prev.intercityFromCity,
        intercityToCity: prev.intercityToCity,
      };
      next.intercityLegs = intercityLegs;
    }
    applyWithTransportInference(next);
  }

  function commitLocationEdit() {
    if (!rangeStart) return;
    const label = locationEdit.trim();
    if (!label) return;

    const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
    const matchingStay = named.find((s) => locationsMatch(stayCityLabel(s), label));

    if (matchingStay) {
      const stays = extendNamedStayToRange(named, matchingStay.id, rangeStart, end, label);
      let gridStart = rangeStart;
      let gridEnd = addDays(end, 1);
      for (const stay of stays) {
        if (stay.checkInDate < gridStart) gridStart = stay.checkInDate;
        if (stay.checkOutDate > gridEnd) gridEnd = stay.checkOutDate;
      }
      const nextDays = dayPlacesFromStays({
        stays,
        intercityLegs: mainIntercityLegs(state),
        trip: {
          startDate: state.basics.startDate,
          endDate: state.basics.endDate,
          departureCity: state.basics.departureCity,
          returnCity: state.basics.returnCity,
        },
        transportDraft: {
          outboundLegs: state.outboundLegs,
          returnLegs: state.returnLegs,
          intercityLegs: state.intercityLegs,
        },
        gridStart,
        gridEnd,
      });
      const next: TripSetupState = {
        ...state,
        accommodationStays: mergeAccommodationStays(state, state.mainGroupId, stays),
        dayPlacesByGroupId: {
          ...state.dayPlacesByGroupId,
          [state.mainGroupId]: nextDays,
        },
      };
      onChange(next);
      void onSave(next);
      return;
    }

    const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
    const nextDays = inferDayPlacesFromStay(
      mainDays,
      {
        cityLabel: label,
        checkInDate: rangeStart,
        checkOutDate: addDays(end, 1),
      },
      { replaceExisting: true },
    );
    const next = syncMainDayPlaces(state, nextDays);
    onChange(next);
    void onSave(next);
  }

  function commitAccommodation(
    stay: AccommodationStayDraft,
    isNew: boolean,
    deleteActivities: boolean,
    locationChoice: DayLocationChoice = { mode: "apply" },
  ) {
    let normalizedStay: AccommodationStayDraft = {
      ...stay,
      cityLabel: stayCityLabel(stay) || stay.cityLabel,
    };
    const existing = mainAccommodationStays(state);
    let stays = isNew
      ? [...existing, normalizedStay]
      : existing.map((s) => (s.id === normalizedStay.id ? normalizedStay : s));

    if (locationChoice.mode === "keep") {
      const keepLabel =
        locationChoice.cityLabel?.trim() || locationConflict?.current.trim() || "";
      if (keepLabel) {
        normalizedStay = { ...normalizedStay, cityLabel: keepLabel };
        stays = isNew
          ? [...existing, normalizedStay]
          : existing.map((s) => (s.id === normalizedStay.id ? normalizedStay : s));
      }
    } else if (locationChoice.mode === "custom") {
      normalizedStay = { ...normalizedStay, cityLabel: locationChoice.label };
      stays = isNew
        ? [...existing, normalizedStay]
        : existing.map((s) => (s.id === normalizedStay.id ? normalizedStay : s));
    }

    const staysBeforeCoalesce = stays.length;
    stays = coalesceAdjacentNamedStays(stays);
    const mergedAdjacentStays = stays.length < staysBeforeCoalesce;

    let activities = state.activities;
    if (deleteActivities) {
      const attachedIds = new Set(
        activitiesAttachedToStay(state.activities, normalizedStay).map((a) => a.id),
      );
      activities = activities.filter((a) => !attachedIds.has(a.id));
    }

    const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
    let nextDays = mainDays;
    if (locationChoice.mode !== "keep") {
      nextDays = isNew
        ? inferDayPlacesFromStay(mainDays, normalizedStay)
        : applyStaysToDayPlaces(mainDays, stays, {
            replaceStayIds: new Set([normalizedStay.id]),
          });
    } else if (mergedAdjacentStays) {
      nextDays = applyStaysToDayPlaces(mainDays, stays);
    }
    const next: TripSetupState = {
      ...state,
      accommodationStays: mergeAccommodationStays(state, state.mainGroupId, stays),
      dayPlacesByGroupId: {
        ...state.dayPlacesByGroupId,
        [state.mainGroupId]: nextDays,
      },
      activities,
    };
    onChange(next);
    setEditingStay(null);
    setDraftStay(null);
    setPendingStay(null);
    setActivitiesModalOpen(false);
    setLocationModalOpen(false);
    setLocationConflict(null);
    setPendingLocationChoice({ mode: "apply" });
    void onSave(next);
  }

  function proceedAfterLocationChoice(
    stay: AccommodationStayDraft,
    isNew: boolean,
    locationChoice: DayLocationChoice,
  ) {
    const attached = activitiesAttachedToStay(state.activities, stay);
    if (attached.length) {
      setPendingStay(stay);
      setPendingIsNew(isNew);
      setPendingLocationChoice(locationChoice);
      setActivitiesModalOpen(true);
      return;
    }
    commitAccommodation(stay, isNew, false, locationChoice);
  }

  function requestAccommodationSave(stay: AccommodationStayDraft, isNew: boolean) {
    if (!stay.name?.trim() || !rangeStart) return;

    const proposed = stayCityLabel(stay) || stay.cityLabel;
    const current = currentAccommodationLocationLabel(state, rangeStart, end, selectedHalf);
    const conflict = accommodationLocationConflict(current, proposed);

    if (conflict) {
      setPendingStay(stay);
      setPendingIsNew(isNew);
      setLocationConflict(conflict);
      setLocationDraft(conflict.proposed);
      setLocationModalOpen(true);
      return;
    }

    proceedAfterLocationChoice(stay, isNew, { mode: "apply" });
  }

  function startEditingStay(stay: AccommodationStayDraft) {
    setEditingStay({ ...stay });
    setDraftStay(null);
  }

  function cancelEditing() {
    setEditingStay(null);
  }

  const attachedCount = pendingStay
    ? activitiesAttachedToStay(state.activities, pendingStay).length
    : 0;

  if (!hasSelection) return null;

  const accommodationFormStay = editingStay ?? draftStay;
  const showAccommodationForm =
    tab === "accommodation" && Boolean(accommodationFormStay) && (Boolean(editingStay) || Boolean(draftStay));

  const showSaveNewButton = tab === "accommodation" && Boolean(draftStay) && !editingStay;

  const showSaveEditButton = Boolean(editingStay);

  const isSingleDay = Boolean(rangeStart && rangeStart === end);
  const splitDay = isSingleDay && day && isSplitDay(day);
  const leftCity = splitDay && day ? cityOnHalf(day, "left").trim() : "";
  const rightCity = splitDay && day ? cityOnHalf(day, "right").trim() : "";
  const wholeDayLabel =
    splitDay && leftCity && rightCity
      ? `${leftCity} → ${rightCity}`
      : locationLabel || rangeStart;

  function focusSelection(
    half: HalfSide | "full",
    focusTab?: CalendarSelection["focusTab"],
  ) {
    if (!rangeStart || !onSelectionChange) return;
    onSelectionChange(rangeStart, half, focusTab);
    if (focusTab) setTab(focusTab);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-zinc-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Selected days
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">{rangeLabel}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 shrink-0 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Done
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {WORKSPACE_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === item.id
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {tab === "overview" ? (
          <div className="space-y-4">
            {splitDay ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-zinc-900">Divided day</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  This day spans two places. Pick the whole day, one half, or open transport
                  between them.
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => focusSelection("full")}
                    className={[
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm",
                      selectedHalf === "full"
                        ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                    ].join(" ")}
                  >
                    <span>Whole day</span>
                    <span className="truncate text-xs text-zinc-500">{wholeDayLabel}</span>
                  </button>
                  {leftCity ? (
                    <button
                      type="button"
                      onClick={() => focusSelection("left")}
                      className={[
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm",
                        selectedHalf === "left"
                          ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <span>First half</span>
                      <span className="truncate text-xs text-zinc-500">{leftCity}</span>
                    </button>
                  ) : null}
                  {rightCity ? (
                    <button
                      type="button"
                      onClick={() => focusSelection("right")}
                      className={[
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm",
                        selectedHalf === "right"
                          ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <span>Second half</span>
                      <span className="truncate text-xs text-zinc-500">{rightCity}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => focusSelection("full", "transport")}
                    className="flex w-full items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 text-left text-sm font-medium text-indigo-950 hover:bg-indigo-100/80"
                  >
                    <span>Transport between halves</span>
                    <span className="text-xs text-indigo-700">Open</span>
                  </button>
                </div>
              </div>
            ) : null}

            {isSingleDay ? (
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <h3 className="text-sm font-semibold text-red-900">Clear this day</h3>
                <p className="mt-1 text-xs text-red-800/80">
                  Remove all locations, accommodation, transport legs, and activities on{" "}
                  {rangeStart}.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleClearEverythingFromDay}
                  className="mt-3 text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  Delete everything from this day
                </button>
              </div>
            ) : null}

            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Location</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Each night is two halves — evening on one day plus morning on the next. Selections
                always include both.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={locationEdit}
                  onChange={(e) => setLocationEdit(e.target.value)}
                  placeholder="City or area"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
                <button
                  type="button"
                  disabled={saving || !locationEdit.trim() || locationEdit.trim() === locationLabel}
                  onClick={commitLocationEdit}
                  className="shrink-0 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              {locationLabel && locationLabel !== locationEdit.trim() ? (
                <p className="mt-2 text-xs text-zinc-500">On calendar: {locationLabel}</p>
              ) : null}
              {locationLabel || staysForSelection.length ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleClearLocation}
                  className="mt-3 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  Clear this night
                </button>
              ) : null}
            </div>

            <OverviewSection
              title="Accommodation"
              empty={accommodationEmptyForSelection}
              showAdd={accommodationEmptyForSelection || hasAccommodationGaps}
              emptyLabel="No hotel or property on these days yet."
              onAdd={() => setTab("accommodation")}
            >
              {hasAccommodationGaps ? (
                <p className="text-xs text-amber-800">
                  Some selected days still need a hotel — use + to add one.
                </p>
              ) : null}
              {staysForSelection.map((stay) => (
                <div
                  key={stay.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{stayTitle(stay)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {stayCityLabel(stay)} · {stayDatesForSelection(stay)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTab("accommodation");
                        startEditingStay(stay);
                      }}
                      className="text-xs font-medium text-sky-800 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDeleteStay(stay)}
                      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </OverviewSection>

            <OverviewSection
              title="Transport"
              empty={legsOnRange.length === 0}
              emptyLabel="No transport planned for these days yet."
              onAdd={() => {
                setTab("transport");
                if (!legsOnRange.length) addFlightLeg();
              }}
            >
              {legsOnRange.map(({ kind, index, leg }) => (
                <button
                  key={leg.id}
                  type="button"
                  onClick={() => setTab("transport")}
                  className="flex w-full items-start justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-left hover:bg-zinc-100/80"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      {transportLegTitle(kind, index)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {leg.flightNumber?.trim() || leg.transportType.replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{legRouteLabel(leg)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-sky-800">Edit</span>
                </button>
              ))}
            </OverviewSection>

            <OverviewSection
              title="Activities"
              empty={activitiesOnRange.length === 0}
              emptyLabel="No activities on these days yet."
              onAdd={() => setTab("activities")}
            >
              {activitiesOnRange.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setTab("activities")}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-left hover:bg-zinc-100/80"
                >
                  <span className="min-w-0 truncate text-sm text-zinc-900">
                    {act.startTime ? `${formatTimeDisplay(act.startTime)} · ` : ""}
                    {act.title}
                  </span>
                  <span className="shrink-0 text-xs text-sky-800">Edit</span>
                </button>
              ))}
            </OverviewSection>
          </div>
        ) : null}

        {tab === "accommodation" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-900">Location</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Each night spans two calendar halves. Selections always include the paired half on
                the next day.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={locationEdit}
                  onChange={(e) => setLocationEdit(e.target.value)}
                  placeholder="City or area"
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
                <button
                  type="button"
                  disabled={saving || !locationEdit.trim() || locationEdit.trim() === locationLabel}
                  onClick={commitLocationEdit}
                  className="shrink-0 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
              {locationLabel || staysForSelection.length ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleClearLocation}
                  className="mt-3 text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
                >
                  Clear this night
                </button>
              ) : null}
            </div>

            {primaryStay && !showAccommodationForm ? (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{stayTitle(primaryStay)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {stayCityLabel(primaryStay)} · {primaryStay.stayType.replace(/_/g, " ")} ·{" "}
                      {primaryStay.checkInDate} – {primaryStay.checkOutDate}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => startEditingStay(primaryStay)}
                      className="text-xs font-medium text-sky-800 hover:underline"
                    >
                      Edit
                    </button>
                    {hasNamedStayOnRange ? (
                      <button
                        type="button"
                        onClick={handleDeleteAccommodation}
                        className="text-xs font-medium text-red-700 hover:underline"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {showAccommodationForm && accommodationFormStay ? (
              <div className="space-y-4">
                {editingStay ? (
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-zinc-900">Edit accommodation</h3>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="text-xs text-zinc-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h3 className="text-sm font-medium text-zinc-900">Add accommodation</h3>
                )}
                <p className="text-xs text-zinc-500">
                  Pick the stay type first — hotels and other properties use different search fields.
                  Location on the calendar updates from this stay.
                </p>
                <div className="rounded-lg border border-zinc-200 p-4">
                  <AccommodationStayForm
                    embedded
                    stay={accommodationFormStay}
                    onChange={(next) => {
                      if (editingStay) setEditingStay(next);
                      else setDraftStay(next);
                    }}
                    countryNames={state.basics.destinationCountries}
                    cityHint={accommodationFormStay.cityLabel}
                  />
                </div>
              </div>
            ) : !primaryStay && !showAccommodationForm ? (
              <button
                type="button"
                onClick={() => setTab("accommodation")}
                className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 hover:border-zinc-400 hover:bg-zinc-50"
              >
                + Add accommodation for these days
              </button>
            ) : null}
          </div>
        ) : null}

        {tab === "transport" ? (
          <div className="space-y-4">
            {transferRoute ? (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 py-5 font-mono text-xl font-semibold tracking-widest text-zinc-900">
                <span>{transferRoute.from}</span>
                <span className="text-base text-zinc-400">-</span>
                <span>{transferRoute.to}</span>
              </div>
            ) : null}

            {legsOnRange.length === 0 ? (
              <button
                type="button"
                onClick={addFlightLeg}
                className="w-full rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-sm font-medium text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
              >
                + Add transport for this day
              </button>
            ) : (
              legsOnRange.map(({ kind, index, leg }) => (
                <TransportLegForm
                  key={leg.id}
                  leg={leg}
                  legTitle={transportLegTitle(kind, index)}
                  legHint={
                    kind === "outbound"
                      ? connectionLegHint(state.outboundLegs[index - 1])
                      : kind === "return"
                        ? connectionLegHint(state.returnLegs[index - 1])
                        : kind === "intercity" && index > 0
                          ? connectionLegHint(state.intercityLegs[index - 1])
                          : undefined
                  }
                  chainFromLeg={
                    kind === "outbound"
                      ? state.outboundLegs[index - 1]
                      : kind === "return"
                        ? state.returnLegs[index - 1]
                        : kind === "intercity" && index > 0
                          ? state.intercityLegs[index - 1]
                          : undefined
                  }
                  tripLookup={{
                    state,
                    ignoreDates: rangeStart ? [rangeStart, end] : undefined,
                  }}
                  showRemove={
                    kind === "outbound"
                      ? state.outboundLegs.length > 1
                      : kind === "return"
                        ? state.returnLegs.length > 1
                        : true
                  }
                  countryNames={state.basics.destinationCountries}
                  roster={roster}
                  onRemove={() => removeLeg(kind, index)}
                  onChange={(next) => updateLeg(kind, index, next)}
                  onFlightResolved={(result) => {
                    if (result.travelDate) onFlightScheduled?.(result.travelDate);
                  }}
                />
              ))
            )}

            {legsOnRange.length > 0 ? (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={addExtraLeg}
                  className="h-10 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  + Extra leg
                </button>
              </div>
            ) : null}

            <p className="text-xs text-zinc-500">
              {transferRoute
                ? "Choose how the group travels between these places — plane, train, bus, or other."
                : "Set depart and arrive times — the transport block moves on the calendar to match."}
            </p>
          </div>
        ) : null}

        {tab === "activities" ? (
          <SetupDayAddsPanel
            embedded
            state={state}
            selection={selection}
            onChange={onChange}
            onConfirmed={onConfirmed}
          />
        ) : null}
      </div>

      {showSaveNewButton && draftStay ? (
        <div className="shrink-0 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            disabled={saving || !draftStay.name?.trim()}
            onClick={() => requestAccommodationSave(draftStay, true)}
            className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save accommodation"}
          </button>
        </div>
      ) : null}

      {showSaveEditButton && editingStay ? (
        <div className="shrink-0 border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            disabled={saving || !editingStay.name?.trim()}
            onClick={() => requestAccommodationSave(editingStay, false)}
            className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Confirm new place"}
          </button>
        </div>
      ) : null}

      <AccommodationLocationModal
        open={locationModalOpen}
        currentLocation={locationConflict?.current ?? ""}
        proposedLocation={locationConflict?.proposed ?? ""}
        draftLocation={locationDraft}
        onDraftChange={setLocationDraft}
        onClose={() => {
          setLocationModalOpen(false);
          setLocationConflict(null);
          setPendingStay(null);
        }}
        onKeep={() => {
          if (pendingStay) {
            proceedAfterLocationChoice(pendingStay, pendingIsNew, {
              mode: "keep",
              cityLabel: locationConflict?.current,
            });
            setLocationModalOpen(false);
            setLocationConflict(null);
          }
        }}
        onChange={() => {
          if (!pendingStay || !locationDraft.trim()) return;
          const choice: DayLocationChoice = { mode: "custom", label: locationDraft.trim() };
          proceedAfterLocationChoice(pendingStay, pendingIsNew, choice);
          setLocationModalOpen(false);
          setLocationConflict(null);
        }}
      />

      <AccommodationActivitiesModal
        open={activitiesModalOpen}
        activityCount={attachedCount}
        onClose={() => {
          setActivitiesModalOpen(false);
          setPendingStay(null);
          setPendingLocationChoice({ mode: "apply" });
        }}
        onKeep={() => {
          if (pendingStay) {
            commitAccommodation(pendingStay, pendingIsNew, false, pendingLocationChoice);
          }
        }}
        onDelete={() => {
          if (pendingStay) {
            commitAccommodation(pendingStay, pendingIsNew, true, pendingLocationChoice);
          }
        }}
      />
    </div>
  );
}
