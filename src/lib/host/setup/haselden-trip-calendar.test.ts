import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isAirportPlace } from "@/lib/geo/airport-codes";
import { locationRangesFromDays } from "@/lib/host/setup/location-range-display";
import {
  classifyImportedFlightChain,
  mergeClassifiedLegsIntoState,
} from "@/lib/host/setup/classify-flight-legs";
import {
  haseldenAug2026State,
  haseldenIntercityLeg,
  haseldenOutboundLegs,
  haseldenReturnLegs,
  haseldenTripContext,
} from "@/lib/host/setup/calendar-fixtures";
import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { deriveHomeArrivalDay, deriveTripBoundsFromContent } from "@/lib/host/setup/derive-trip-bounds";
import { effectiveHotelBandStart } from "@/lib/host/setup/accommodation-calendar";
import { locationRangesFromContent } from "@/lib/host/setup/location-range-display";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { calendarGridBounds, calendarScrollBounds } from "@/lib/host/setup/calendar-bounds";
import { hasScheduledReturnTransport } from "@/lib/host/wizard/transport-day-placement";
import { allPlaneLegsFromState } from "@/lib/host/setup/infer-flight-calendar";

describe("haselden Aug 2026 golden trip", () => {
  const state = haseldenAug2026State();

  it("classifies outbound, return, and intercity legs", () => {
    const outbound = classifyImportedFlightChain(haseldenOutboundLegs(), state);
    assert.equal(outbound.outbound.length, 2);
    assert.equal(outbound.return.length, 0);

    const ret = classifyImportedFlightChain(haseldenReturnLegs(), state);
    assert.equal(ret.return.length, 2);

    const ic = classifyImportedFlightChain([haseldenIntercityLeg()], state);
    assert.equal(ic.intercity.length, 1);
  });

  it("derives last abroad day Sep 4 with home arrival Sep 5", () => {
    const bounds = deriveTripBoundsFromContent({
      accommodationStays: state.accommodationStays,
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      intercityLegs: state.intercityLegs,
      returnCity: state.basics.returnCity,
    });
    assert.equal(bounds?.endDate, "2026-09-04");

    const homeArrival = deriveHomeArrivalDay(
      {
        returnLegs: state.returnLegs,
        returnCity: state.basics.returnCity,
      },
      bounds!.endDate,
    );
    assert.equal(homeArrival, "2026-09-05");
  });

  it("defers Patong hotel band until after late outbound arrival", () => {
    const patong = state.accommodationStays[0]!;
    const planeLegs = allPlaneLegsFromState(state);
    assert.equal(effectiveHotelBandStart(patong, planeLegs), "2026-08-24");
  });

  it("paints location days and day-scoped overnight return (no calendar transit bands)", () => {
    const synced = applySetupTransportChange(state, {});
    const trip = {
      startDate: synced.basics.startDate,
      endDate: synced.basics.endDate,
      departureCity: synced.basics.departureCity,
      returnCity: synced.basics.returnCity,
    };
    const scroll = calendarScrollBounds(trip.startDate, trip.endDate, synced.basics.timezone);
    const grid = calendarGridBounds(scroll.scrollStart, scroll.scrollEnd);
    const derived = deriveCalendarState({
      stays: state.accommodationStays,
      intercityLegs: state.intercityLegs,
      trip,
      transportDraft: synced,
      gridStart: grid.gridStart,
      gridEnd: grid.gridEnd,
      overlayStoredLocationGaps: false,
    });

    const aug22 = derived.dayPlaces.find((d) => d.date === "2026-08-22");
    const sep6 = derived.dayPlaces.find((d) => d.date === "2026-09-06");
    const sep4Day = derived.dayPlaces.find((d) => d.date === "2026-09-04");
    const sep5Day = derived.dayPlaces.find((d) => d.date === "2026-09-05");
    const aug24 = derived.dayPlaces.find((d) => d.date === "2026-08-24");
    assert.equal(sep4Day?.primaryCity, "Bangkok");
    assert.ok(!sep4Day?.secondaryCity?.trim());
    assert.ok((sep4Day?.primaryShare ?? 1) < 1);
    assert.equal(sep4Day?.dayType, "trip");
    const sep1 = derived.dayPlaces.find((d) => d.date === "2026-09-01");
    assert.equal(sep1?.primaryCity, sep4Day?.primaryCity);
    assert.ok(!sep5Day?.secondaryCity?.toLowerCase().includes("melbourne"));
    assert.equal(aug24?.primaryCity, "Patong");
    assert.equal(aug24?.primaryShare, 1);
    assert.ok(derived.accommodationByDate.has("2026-08-24"));

    const locationRanges = locationRangesFromContent({
      days: derived.dayPlaces,
      tripStart: trip.startDate,
      tripEnd: trip.endDate,
      departureCity: trip.departureCity,
      returnCity: trip.returnCity,
      hasReturnTransport: true,
      accommodationStays: state.accommodationStays,
      outboundLegs: synced.outboundLegs,
      returnLegs: synced.returnLegs,
      intercityLegs: synced.intercityLegs,
    });
    const patongRange = locationRanges.find((r) => r.location === "Patong");
    assert.equal(patongRange?.startDate, "2026-08-24");
    assert.ok(!locationRanges.some((r) => r.location === "Phuket"));
    assert.equal(aug22?.dayType, "buffer");
    assert.ok(aug22?.primaryCity.includes("Christchurch"));
    assert.equal(aug22?.primaryShare, 1);
    assert.equal(sep6?.dayType, "buffer");
    assert.ok(sep6?.primaryCity.includes("Christchurch"));
    assert.equal(sep6?.primaryShare, 1);
    assert.equal(synced.basics.endDate, haseldenTripContext.endDate);
  });

  it("deleting outbound legs does not orphan Christchurch or airport location ranges", () => {
    const withoutOutbound = applySetupTransportChange(state, { outboundLegs: [] });
    const days = withoutOutbound.dayPlacesByGroupId[withoutOutbound.mainGroupId] ?? [];
    const ranges = locationRangesFromDays({
      days,
      tripStart: withoutOutbound.basics.startDate,
      tripEnd: withoutOutbound.basics.endDate,
      departureCity: withoutOutbound.basics.departureCity,
      returnCity: withoutOutbound.basics.returnCity,
      hasReturnTransport: hasScheduledReturnTransport(withoutOutbound, {
        endDate: withoutOutbound.basics.endDate,
        returnCity: withoutOutbound.basics.returnCity,
      }),
    });

    for (const range of ranges) {
      assert.equal(isAirportPlace(range.location), false, range.location);
    }
    assert.ok(!days.find((d) => d.date === "2026-08-22")?.primaryCity.trim());
    assert.ok(!days.find((d) => d.date === "2026-08-23")?.primaryCity.includes("Christchurch"));
  });

  it("deleting one outbound leg keeps metro home labels, not airport strings", () => {
    const partial = applySetupTransportChange(state, {
      outboundLegs: state.outboundLegs.slice(0, 1),
    });
    assert.ok(!isAirportPlace(partial.basics.returnCity));
    assert.ok(!isAirportPlace(partial.basics.departureCity));

    const days = partial.dayPlacesByGroupId[partial.mainGroupId] ?? [];
    const ranges = locationRangesFromDays({
      days,
      tripStart: partial.basics.startDate,
      tripEnd: partial.basics.endDate,
      departureCity: partial.basics.departureCity,
      returnCity: partial.basics.returnCity,
      hasReturnTransport: hasScheduledReturnTransport(partial, {
        endDate: partial.basics.endDate,
        returnCity: partial.basics.returnCity,
      }),
    });
    for (const range of ranges) {
      assert.equal(isAirportPlace(range.location), false, range.location);
    }
  });

  it("mergeClassifiedFlightChain places return legs in return bucket", () => {
    const merged = mergeClassifiedLegsIntoState(
      { ...state, outboundLegs: [], returnLegs: [], intercityLegs: [] },
      classifyImportedFlightChain(haseldenReturnLegs(), state),
    );
    assert.equal(merged.returnLegs.length, 2);
    assert.equal(merged.intercityLegs.length, 0);
  });
});
