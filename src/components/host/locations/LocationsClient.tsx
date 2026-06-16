"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AccommodationAssignmentsPanel } from "@/components/host/locations/AccommodationAssignmentsPanel";
import { AccommodationClient } from "@/components/host/accommodation/AccommodationClient";
import { AccommodationStayForm } from "@/components/host/wizard/shared/AccommodationStayForm";
import { TransportLegForm } from "@/components/host/wizard/shared/TransportLegForm";
import {
  ConfirmedStaysList,
  LocationAssignmentPanel,
} from "@/components/host/wizard/shared/LocationAssignmentPanel";
import { LocationStayCalendar } from "@/components/host/wizard/shared/LocationStayCalendar";
import { applyCrossoverDrag } from "@/lib/host/wizard/crossover-adjust";
import {
  suggestAccommodationStays,
  syncIntercityLegs,
} from "@/lib/host/wizard/detect-city-moves";
import {
  applyLocationStays,
  coalesceAdjacentStays,
  effectiveStayStart,
  getEmptyHalf,
  hasUncoveredTripDays,
  inferStaysFromDayPlaces,
  mergeStaysWithNewRange,
  previewStayMerge,
  trimStaysForNewRange,
  type HalfSide,
  type LocationStayDraft,
} from "@/lib/host/wizard/location-stays";
import {
  computeCalendarTransport,
  flightArrivalDates,
  flightDepartureDates,
  returnDepartsAfterTripEnd,
  travelLayoutMorningPaintEnd,
  travelLayoutPaintStart,
  travelPaintStartByDate,
} from "@/lib/host/wizard/transport-day-placement";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  StayType,
  TransportLegDraft,
  TripWizardDraft,
} from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
import type { TripLocationState } from "@/lib/host/locations/types";

export function LocationsClient(props: {
  tripId: string;
  inviteCode: string;
  focusDate?: string | null;
}) {
  const { tripId, inviteCode, focusDate } = props;
  const [state, setState] = useState<TripLocationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [stays, setStays] = useState<LocationStayDraft[]>([]);
  const [pendingLocation, setPendingLocation] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeStartHalf, setRangeStartHalf] = useState<HalfSide | "full">("full");
  const [rangeEndHalf, setRangeEndHalf] = useState<HalfSide | "full">("full");
  const [staysInitialized, setStaysInitialized] = useState(false);
  const [roster, setRoster] = useState<{
    groups: Array<{ id: string; name: string }>;
    participants: Array<{ id: string; fullName: string }>;
    rooms: Array<{ id: string; roomName: string }>;
  }>({ groups: [], participants: [], rooms: [] });

  const load = useCallback(async () => {
    const res = await fetch(`/api/trips/${tripId}/locations`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Failed to load locations");
    setState(body.state);
    setStaysInitialized(false);
  }, [tripId]);

  useEffect(() => {
    fetch(`/api/host/${encodeURIComponent(inviteCode)}/roster`)
      .then((res) => res.json())
      .then((body) => {
        setRoster({
          groups: body.groups ?? [],
          participants: body.participants ?? [],
          rooms: body.rooms ?? [],
        });
      })
      .catch(() => setRoster({ groups: [], participants: [], rooms: [] }));
  }, [inviteCode]);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [load]);

  const basics = state?.basics;
  const dayPlaces = state?.dayPlaces ?? [];

  function tripContext() {
    return {
      startDate: basics?.startDate ?? "",
      endDate: basics?.endDate ?? "",
      departureCity: basics?.departureCity ?? "",
      returnCity: basics?.returnCity ?? "",
    };
  }

  const transportDraft = useMemo(
    (): Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs" | "dayPlaces"> => ({
      outboundLegs: state?.outboundLegs ?? [],
      returnLegs: state?.returnLegs ?? [],
      intercityLegs: state?.intercityLegs ?? [],
      dayPlaces: state?.dayPlaces ?? [],
    }),
    [state?.outboundLegs, state?.returnLegs, state?.intercityLegs, state?.dayPlaces],
  );

  const { travelLayouts: travelLayoutsByDate, transitOverlays: transitByDate } = useMemo(
    () =>
      computeCalendarTransport(transportDraft, tripContext(), {
        stays: state?.accommodationStays ?? [],
      }),
    [
      transportDraft,
      basics?.startDate,
      basics?.endDate,
      basics?.departureCity,
      basics?.returnCity,
      state?.accommodationStays,
    ],
  );

  function finalizeDays(nextStays: LocationStayDraft[]): DayPlaceDraft[] {
    const ctx = tripContext();
    return applyLocationStays(
      dayPlaces,
      nextStays,
      ctx,
      flightDepartureDates(transportDraft, ctx),
      travelPaintStartByDate(transportDraft, ctx),
      flightArrivalDates(transportDraft, ctx),
      returnDepartsAfterTripEnd(transportDraft, ctx.endDate),
    );
  }

  useEffect(() => {
    if (!state || staysInitialized || !basics?.startDate || !basics.endDate) return;
    const inferred = inferStaysFromDayPlaces(
      dayPlaces,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    );
    if (inferred.length) {
      setStays(inferred);
    }
    setStaysInitialized(true);
  }, [state, staysInitialized, dayPlaces, basics]);

  useEffect(() => {
    if (!focusDate || !basics?.startDate || !basics.endDate) return;
    if (focusDate < basics.startDate || focusDate > basics.endDate) return;
    setRangeStart(focusDate);
    setRangeEnd(focusDate);
  }, [focusDate, basics?.startDate, basics?.endDate]);

  function patchState(patch: Partial<TripLocationState>) {
    if (!state) return;
    setState({ ...state, ...patch });
    setSaved(false);
  }

  function commitStays(nextStays: LocationStayDraft[]) {
    if (!state) return;
    const coalesced = coalesceAdjacentStays(nextStays);
    setStays(coalesced);
    const finalDays = finalizeDays(coalesced);
    const intercityLegs = syncIntercityLegs(finalDays, state.intercityLegs, {
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      trip: tripContext(),
    });
    setState({ ...state, dayPlaces: finalDays, intercityLegs });
    setSaved(false);
  }

  const needsMoreLocations = useMemo(() => {
    if (!basics?.startDate || !basics?.endDate) return false;
    return hasUncoveredTripDays(dayPlaces, basics.startDate, basics.endDate);
  }, [dayPlaces, basics?.startDate, basics?.endDate]);

  const adjacentMerge = useMemo(() => {
    if (!pendingLocation.trim() || !rangeStart) return null;
    const endDate = rangeEnd || rangeStart;
    const startDate = effectiveStayStart(rangeStart, endDate, dayPlaces);
    const preview = previewStayMerge(stays, pendingLocation, startDate, endDate);
    return preview ? { stay: preview } : null;
  }, [pendingLocation, rangeStart, rangeEnd, dayPlaces, stays]);

  function halfForDate(iso: string): HalfSide | "full" {
    const day = dayPlaces.find((d) => d.date === iso);
    const emptyHalf = day ? getEmptyHalf(day) : null;
    if (emptyHalf) return emptyHalf;
    const segments = travelLayoutsByDate.get(iso);
    const paintStart = travelLayoutPaintStart(segments);
    const morningEnd = travelLayoutMorningPaintEnd(segments);
    if (morningEnd > 0 && morningEnd < 1 && !day?.primaryCity.trim()) return "left";
    if (paintStart > 0 && paintStart < 1 && !day?.secondaryCity?.trim()) return "right";
    return "full";
  }

  function setRangeWithHalves(start: string, end: string) {
    setRangeStart(start);
    setRangeEnd(end);
    setRangeStartHalf(halfForDate(start));
    setRangeEndHalf(halfForDate(end));
  }

  function onCalendarDayClick(iso: string) {
    if (!basics) return;
    if (iso < basics.startDate || iso > basics.endDate) return;
    if (iso === basics.startDate || iso === basics.endDate) return;

    const start = rangeStart;
    const end = rangeEnd || rangeStart;

    if (rangeStart && iso >= start && iso <= end) {
      if (start === end) {
        setRangeStart("");
        setRangeEnd("");
        return;
      }
      setRangeWithHalves(iso, iso);
      return;
    }

    if (!rangeStart) {
      setRangeWithHalves(iso, iso);
      return;
    }

    setRangeWithHalves(iso < start ? iso : start, iso > end ? iso : end);
  }

  function confirmLocation() {
    if (!pendingLocation.trim() || !rangeStart) return;
    const endDate = rangeEnd || rangeStart;
    const location = pendingLocation.trim();
    const startDate = effectiveStayStart(rangeStart, endDate, dayPlaces);
    const trimmed = trimStaysForNewRange(stays, location, startDate, dayPlaces);
    const nextStays = mergeStaysWithNewRange(trimmed, location, startDate, endDate);
    commitStays(nextStays);
    setPendingLocation("");
    setRangeStart("");
    setRangeEnd("");
  }

  function updateDayShare(date: string, primaryShare: number) {
    if (!state || !basics?.startDate || !basics.endDate) return;
    const ctx = tripContext();
    const nextDays = applyCrossoverDrag(dayPlaces, date, primaryShare, ctx, {
      flightDepartureDates: flightDepartureDates(transportDraft, ctx),
      flightArrivalDates: flightArrivalDates(transportDraft, ctx),
      skipEndHomeLock: returnDepartsAfterTripEnd(transportDraft, ctx.endDate),
    });
    const intercityLegs = syncIntercityLegs(nextDays, state.intercityLegs, {
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      trip: ctx,
    });
    const inferred = inferStaysFromDayPlaces(
      nextDays,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    );
    setStays(inferred);
    patchState({ dayPlaces: nextDays, intercityLegs });
  }

  function pendingFillHalf(iso: string): HalfSide | "full" | null {
    if (!rangeStart) return null;
    const end = rangeEnd || rangeStart;
    if (iso < rangeStart || iso > end) return null;
    const day = dayPlaces.find((d) => d.date === iso);
    const emptyHalf = day ? getEmptyHalf(day) : null;
    if (emptyHalf) return emptyHalf;
    if (iso === rangeStart && iso === end) return rangeStartHalf;
    if (iso === rangeStart) return rangeStartHalf;
    if (iso === end) return rangeEndHalf;
    return "full";
  }

  function updateOutboundLeg(i: number, leg: TransportLegDraft) {
    if (!state) return;
    patchState({
      outboundLegs: state.outboundLegs.map((l, j) => (j === i ? leg : l)),
    });
  }

  function updateReturnLeg(i: number, leg: TransportLegDraft) {
    if (!state) return;
    patchState({
      returnLegs: state.returnLegs.map((l, j) => (j === i ? leg : l)),
    });
  }

  function updateIntercityLeg(i: number, leg: IntercityLegDraft) {
    if (!state) return;
    patchState({
      intercityLegs: state.intercityLegs.map((l, j) => (j === i ? leg : l)),
    });
  }

  function updateStay(i: number, patch: Partial<AccommodationStayDraft>) {
    if (!state) return;
    patchState({
      accommodationStays: state.accommodationStays.map((s, j) =>
        j === i ? { ...s, ...patch } : s,
      ),
    });
  }

  function suggestStays() {
    if (!state) return;
    const suggested = suggestAccommodationStays(dayPlaces);
    patchState({
      accommodationStays: suggested.map((s) => ({
        id: newId(),
        cityLabel: s.cityLabel,
        stayType: "hotel" as StayType,
        name: null,
        url: null,
        address: null,
        phone: null,
        checkInDate: s.checkInDate,
        checkOutDate: s.checkOutDate,
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      })),
    });
  }

  async function save() {
    if (!state) return;
    setSaving(true);
    setError(null);
    try {
      let next = { ...state };
      next.intercityLegs = syncIntercityLegs(next.dayPlaces, next.intercityLegs, {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        trip: {
          startDate: next.basics.startDate,
          endDate: next.basics.endDate,
          departureCity: next.basics.departureCity,
          returnCity: next.basics.returnCity,
        },
      });
      if (!next.accommodationStays.length && next.dayPlaces.length) {
        const suggested = suggestAccommodationStays(next.dayPlaces);
        next = {
          ...next,
          accommodationStays: suggested.map((s) => ({
            id: newId(),
            cityLabel: s.cityLabel,
            stayType: "hotel" as StayType,
            name: null,
            url: null,
            address: null,
            phone: null,
            checkInDate: s.checkInDate,
            checkOutDate: s.checkOutDate,
            notes: null,
            isHomestayGroup: false,
            multipleInCity: false,
          })),
        };
        setState(next);
      }

      const res = await fetch(`/api/trips/${tripId}/locations`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: next }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Save failed");
      setSaved(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading locations…</p>;
  }

  if (!state || !basics) {
    return <p className="text-sm text-red-700">{error ?? "Could not load trip locations."}</p>;
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Locations</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Calendar, transport, accommodation stays, and room assignments for this trip.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-10 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Where are you when?</h2>
        {!basics.startDate || !basics.endDate ? (
          <p className="text-sm text-amber-700">Set trip dates in trip settings first.</p>
        ) : (
          <>
            <LocationAssignmentPanel
              extendingStay={adjacentMerge?.stay.location}
              location={pendingLocation}
              onLocationChange={setPendingLocation}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd || rangeStart}
              onConfirm={confirmLocation}
              onClearDates={rangeStart ? () => {
                setRangeStart("");
                setRangeEnd("");
              } : undefined}
              countryNames={basics.destinationCountries}
            />

            <LocationStayCalendar
              days={dayPlaces}
              tripStart={basics.startDate}
              tripEnd={basics.endDate}
              departureCity={basics.departureCity}
              returnCity={basics.returnCity}
              travelLayoutsByDate={travelLayoutsByDate}
              transitByDate={transitByDate}
              selectable
              pendingRangeStart={rangeStart}
              pendingRangeEnd={rangeEnd || rangeStart}
              pendingFillHalf={pendingFillHalf}
              onDayClick={onCalendarDayClick}
              onShareChange={updateDayShare}
            />

            <ConfirmedStaysList
              stays={stays}
              onRemove={(index) => commitStays(stays.filter((_, i) => i !== index))}
              onClearAll={() => commitStays([])}
            />
          </>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">There &amp; back</h2>
        {state.outboundLegs.length === 0 ? (
          <button
            type="button"
            onClick={() =>
              patchState({
                outboundLegs: [
                  {
                    id: newId(),
                    transportType: "plane",
                    bookingStatus: "not_booked",
                    travelDate: basics.startDate,
                    arrivalDate: null,
                    departureTime: null,
                    arrivalTime: null,
                    fromCity: basics.departureCity,
                    toCity: "",
                    fromStation: null,
                    toStation: null,
                    operator: null,
                    referenceNumber: null,
                    flightNumber: null,
                    notes: null,
                  },
                ],
              })
            }
            className="text-sm font-medium text-sky-800"
          >
            + Add outbound flight
          </button>
        ) : (
          state.outboundLegs.map((leg, i) => (
            <TransportLegForm
              key={leg.id}
              leg={leg}
              legTitle={i === 0 ? "Outbound flight" : `Connection ${i}`}
              countryNames={basics.destinationCountries}
              roster={roster}
              onChange={(next) => updateOutboundLeg(i, next)}
            />
          ))
        )}
        {state.returnLegs.length === 0 ? (
          <button
            type="button"
            onClick={() =>
              patchState({
                returnLegs: [
                  {
                    id: newId(),
                    transportType: "plane",
                    bookingStatus: "not_booked",
                    travelDate: basics.endDate,
                    arrivalDate: null,
                    departureTime: null,
                    arrivalTime: null,
                    fromCity: "",
                    toCity: basics.returnCity,
                    fromStation: null,
                    toStation: null,
                    operator: null,
                    referenceNumber: null,
                    flightNumber: null,
                    notes: null,
                  },
                ],
              })
            }
            className="text-sm font-medium text-sky-800"
          >
            + Add return flight
          </button>
        ) : (
          state.returnLegs.map((leg, i) => (
            <TransportLegForm
              key={leg.id}
              leg={leg}
              legTitle={i === 0 ? "Return flight" : `Return connection ${i}`}
              countryNames={basics.destinationCountries}
              roster={roster}
              onChange={(next) => updateReturnLeg(i, next)}
            />
          ))
        )}
      </section>

      {state.intercityLegs.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Between cities</h2>
          {state.intercityLegs.map((leg, i) => (
            <div key={leg.id} className="space-y-2">
              <p className="text-sm font-medium text-zinc-800">
                {leg.intercityFromCity} → {leg.intercityToCity}
                <span className="ml-2 font-normal text-zinc-500">{leg.travelDate}</span>
              </p>
              <TransportLegForm
                leg={leg}
                legTitle={`${leg.intercityFromCity} → ${leg.intercityToCity}`}
                countryNames={basics.destinationCountries}
                roster={roster}
                onChange={(next) =>
                  updateIntercityLeg(i, {
                    ...next,
                    intercityFromCity: leg.intercityFromCity,
                    intercityToCity: leg.intercityToCity,
                  })
                }
              />
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Accommodation stays</h2>
          {state.accommodationStays.length === 0 ? (
            <button type="button" onClick={suggestStays} className="text-sm font-medium text-sky-800">
              Suggest from calendar
            </button>
          ) : null}
        </div>
        {state.accommodationStays.length === 0 ? (
          <p className="text-sm text-zinc-600">No stays yet — save the calendar or suggest from day plan.</p>
        ) : (
          <div className="space-y-4">
            {state.accommodationStays.map((stay, i) => (
              <div key={stay.id} className="rounded-xl border border-zinc-200 p-4 space-y-3">
                <h3 className="font-medium">Staying in {stay.cityLabel}</h3>
                <p className="text-xs text-zinc-500">
                  {stay.checkInDate} – {stay.checkOutDate}
                </p>
                <AccommodationStayForm
                  embedded
                  stay={stay}
                  onChange={(updated) => updateStay(i, updated)}
                  countryNames={state.basics.destinationCountries}
                  cityHint={stay.cityLabel}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <AccommodationAssignmentsPanel
        tripId={tripId}
        stays={state.accommodationStays}
        groups={roster.groups}
        participants={roster.participants}
      />

      <section className="space-y-4 border-t border-zinc-200 pt-8">
        <h2 className="text-lg font-semibold">Rooms &amp; groups</h2>
        <AccommodationClient tripId={tripId} inviteCode={inviteCode} compact />
      </section>
    </div>
  );
}
