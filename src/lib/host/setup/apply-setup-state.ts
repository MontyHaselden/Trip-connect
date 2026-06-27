import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { sanitizeDayType } from "@/lib/trip-engine/sanitize-day-place";
import { dayPlaceToSlice, sliceToDayPlace } from "@/lib/calendar-core/adapters";
import {
  groupDayPlaces,
  groupOverlayOps,
  itineraryItems,
  tripAccommodationStays,
  tripTransportLegs,
  groups,
} from "@/lib/db/schema";
import {
  inferDayPlacesFromIntercityLeg,
  inferDayPlacesFromStay,
  inferHideOpsForGroupStays,
} from "@/lib/host/setup-inference";
import {
  applyTripLocationState,
  syncAccommodationStays,
  syncTripDaysPatch,
  syncTransportLegsTable,
} from "@/lib/host/locations/apply-location-state";
import { syncTransportProductsTable } from "@/lib/host/locations/transport-products";
import { reconcileImportedAccommodationStays } from "@/lib/host/import/reconcile-accommodation-stays";
import { toDbBookingStatus, toDbTransportType } from "@/lib/host/wizard/db-enums";
import { resolveItemVisibility, persistEntityVisibility } from "@/lib/visibility/item-visibility";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
} from "@/lib/host/wizard/types";
import { normalizeDayShare } from "@/lib/host/wizard/location-stays";

import { mainAccommodationStays, mainIntercityLegs, mainTransportLegs } from "./entity-scope";
import type { GroupOverlayOpDraft, TripSetupState } from "./types";

function travelCalendarLabel(day: DayPlaceDraft): string | null {
  const slice = dayPlaceToSlice(day);
  const am = slice.amCity.trim();
  const pm = slice.pmCity.trim();
  if (am && pm && am !== pm) return `${am} → ${pm}`;
  if (am && pm && am === pm) return null;
  if (am && pm) return `${am} / ${pm}`;
  if (day.dayType === "travel" && day.secondaryCity?.trim()) {
    return `${day.primaryCity} → ${day.secondaryCity}`;
  }
  if (day.secondaryCity?.trim()) {
    return `${day.primaryCity} / ${day.secondaryCity}`;
  }
  return null;
}

function normalizeIsoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const trimmed = String(value).trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
}

function dedupeDaysByDate(days: DayPlaceDraft[]): DayPlaceDraft[] {
  const byDate = new Map<string, DayPlaceDraft>();
  for (const day of days) {
    byDate.set(normalizeIsoDate(day.date), { ...day, date: normalizeIsoDate(day.date) });
  }
  return [...byDate.values()];
}

export async function syncGroupDayPlaces(
  tripId: string,
  groupId: string,
  days: DayPlaceDraft[],
) {
  const normalizedDays = dedupeDaysByDate(days);
  const existing = await db
    .select({ id: groupDayPlaces.id, date: groupDayPlaces.date })
    .from(groupDayPlaces)
    .where(and(eq(groupDayPlaces.tripId, tripId), eq(groupDayPlaces.groupId, groupId)));

  const incomingDates = new Set(normalizedDays.map((d) => d.date));
  const deleteIds = existing
    .filter((row) => !incomingDates.has(normalizeIsoDate(row.date)))
    .map((row) => row.id);
  if (deleteIds.length) {
    await db.delete(groupDayPlaces).where(inArray(groupDayPlaces.id, deleteIds));
  }

  if (!normalizedDays.length) return;

  const updatedAt = new Date();
  const UPSERT_CHUNK = 50;
  for (let i = 0; i < normalizedDays.length; i += UPSERT_CHUNK) {
    const chunk = normalizedDays.slice(i, i + UPSERT_CHUNK);
    const rows = chunk.map((day) => {
      const slice = dayPlaceToSlice(day);
      const legacy = sliceToDayPlace(slice);
      return {
        tripId,
        groupId,
        date: day.date,
        amCity: slice.amCity,
        pmCity: slice.pmCity,
        primaryCity: legacy.primaryCity,
        secondaryCity: legacy.secondaryCity,
        primaryShare: String(normalizeDayShare(legacy.primaryShare)),
        dayType: sanitizeDayType(day.dayType),
        calendarLabel: travelCalendarLabel(day),
        weatherLocationQuery: slice.amCity.trim() || slice.pmCity.trim() || null,
        updatedAt,
      };
    });

    await db
      .insert(groupDayPlaces)
      .values(rows)
      .onConflictDoUpdate({
        target: [groupDayPlaces.tripId, groupDayPlaces.groupId, groupDayPlaces.date],
        set: {
          amCity: sql`excluded.am_city`,
          pmCity: sql`excluded.pm_city`,
          primaryCity: sql`excluded.primary_city`,
          secondaryCity: sql`excluded.secondary_city`,
          primaryShare: sql`excluded.primary_share`,
          dayType: sql`excluded.day_type`,
          calendarLabel: sql`excluded.calendar_label`,
          weatherLocationQuery: sql`excluded.weather_location_query`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
}

async function syncOverlayOps(tripId: string, ops: GroupOverlayOpDraft[]) {
  const existing = await db
    .select({ id: groupOverlayOps.id })
    .from(groupOverlayOps)
    .where(eq(groupOverlayOps.tripId, tripId));

  const incomingIds = new Set(ops.map((o) => o.id));
  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db.delete(groupOverlayOps).where(eq(groupOverlayOps.id, row.id));
    }
  }

  const existingIds = new Set(existing.map((r) => r.id));
  for (const op of ops) {
    const values = {
      tripId,
      groupId: op.groupId,
      entityType: op.entityType,
      baseEntityId: op.baseEntityId,
      op: op.op,
      replacementEntityId: op.replacementEntityId,
      effectiveFrom: op.effectiveFrom,
      effectiveTo: op.effectiveTo,
      updatedAt: new Date(),
    };
    if (existingIds.has(op.id)) {
      await db.update(groupOverlayOps).set(values).where(eq(groupOverlayOps.id, op.id));
    } else {
      await db.insert(groupOverlayOps).values({ id: op.id, ...values });
    }
  }
}

function intercityToRow(tripId: string, leg: IntercityLegDraft, sortOrder: number) {
  const visibility = resolveItemVisibility(leg);
  return {
    id: leg.id,
    tripId,
    legKind: "intercity" as const,
    transportType: toDbTransportType(leg.transportType),
    bookingStatus: toDbBookingStatus(leg.bookingStatus),
    travelDate: leg.travelDate,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime,
    fromCity: leg.fromCity || null,
    toCity: leg.toCity || null,
    fromStation: leg.fromStation,
    toStation: leg.toStation,
    operator: leg.operator,
    referenceNumber: leg.referenceNumber,
    flightNumber: leg.flightNumber,
    notes: leg.notes,
    intercityFromCity: leg.intercityFromCity,
    intercityToCity: leg.intercityToCity,
    sortOrder,
    visibilityMode: visibility.visibilityMode,
    originGroupId: leg.originGroupId ?? null,
    sourceEntityId: leg.sourceEntityId ?? null,
    transportProductId: leg.transportProductId ?? null,
  };
}

async function syncGroupIntercityLegs(
  tripId: string,
  groupId: string,
  legs: IntercityLegDraft[],
) {
  const incomingIds = new Set(legs.map((l) => l.id));
  const existing = await db
    .select({ id: tripTransportLegs.id })
    .from(tripTransportLegs)
    .where(
      and(
        eq(tripTransportLegs.tripId, tripId),
        eq(tripTransportLegs.legKind, "intercity"),
        eq(tripTransportLegs.originGroupId, groupId),
      ),
    );

  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db.delete(tripTransportLegs).where(eq(tripTransportLegs.id, row.id));
    }
  }

  const existingIds = new Set(existing.map((r) => r.id));
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const row = intercityToRow(tripId, { ...leg, originGroupId: groupId }, i);
    const visibility = resolveItemVisibility(leg);
    if (existingIds.has(leg.id)) {
      await db.update(tripTransportLegs).set(row).where(eq(tripTransportLegs.id, leg.id));
    } else {
      await db.insert(tripTransportLegs).values(row);
    }
    await persistEntityVisibility(
      tripId,
      "transport_leg",
      leg.id,
      visibility.visibilityMode,
      visibility.targets,
    );
  }
}

async function syncGroupAccommodationStays(
  tripId: string,
  groupId: string,
  stays: AccommodationStayDraft[],
) {
  const incomingIds = new Set(stays.map((s) => s.id));
  const existing = await db
    .select({ id: tripAccommodationStays.id })
    .from(tripAccommodationStays)
    .where(
      and(
        eq(tripAccommodationStays.tripId, tripId),
        eq(tripAccommodationStays.originGroupId, groupId),
      ),
    );

  for (const row of existing) {
    if (!incomingIds.has(row.id)) {
      await db.delete(tripAccommodationStays).where(eq(tripAccommodationStays.id, row.id));
    }
  }

  const existingIds = new Set(existing.map((r) => r.id));
  for (let i = 0; i < stays.length; i++) {
    const s = stays[i]!;
    const visibility = resolveItemVisibility(s);
    const values = {
      tripId,
      cityLabel: s.cityLabel,
      stayType: s.stayType,
      name: s.name,
      url: s.url,
      address: s.address,
      phone: s.phone,
      googlePlaceId: s.googlePlaceId ?? null,
      latitude: s.latitude != null ? String(s.latitude) : null,
      longitude: s.longitude != null ? String(s.longitude) : null,
      checkInDate: s.checkInDate,
      checkOutDate: s.checkOutDate,
      notes: s.notes,
      isHomestayGroup: s.isHomestayGroup,
      sortOrder: i,
      visibilityMode: visibility.visibilityMode,
      originGroupId: groupId,
      sourceEntityId: s.sourceEntityId ?? null,
    };
    if (existingIds.has(s.id)) {
      await db
        .update(tripAccommodationStays)
        .set(values)
        .where(eq(tripAccommodationStays.id, s.id));
    } else {
      await db.insert(tripAccommodationStays).values({ id: s.id, ...values });
    }
    await persistEntityVisibility(
      tripId,
      "accommodation_stay",
      s.id,
      visibility.visibilityMode,
      visibility.targets,
    );
  }
}

function applyGroupInference(
  state: TripSetupState,
  activeGroupId: string,
): TripSetupState {
  if (activeGroupId === state.mainGroupId) return state;

  const group = state.groups?.find((g) => g.id === activeGroupId);
  const isLocationOverlay = group?.inheritMode === "overlay";

  let dayPlaces = state.dayPlacesByGroupId[activeGroupId] ?? [];
  const groupStays = state.accommodationStays.filter((s) => s.originGroupId === activeGroupId);
  const groupLegs = state.intercityLegs.filter((l) => l.originGroupId === activeGroupId);

  for (const stay of groupStays) {
    dayPlaces = inferDayPlacesFromStay(dayPlaces, stay, { replaceExisting: true });
  }
  if (!isLocationOverlay) {
    for (const leg of groupLegs) {
      if (leg.surfaceOnly) continue;
      dayPlaces = inferDayPlacesFromIntercityLeg(dayPlaces, leg, { stays: groupStays });
    }
  }

  const overlayOps = inferHideOpsForGroupStays(
    activeGroupId,
    mainAccommodationStays(state),
    groupStays,
    state.overlayOps,
  );

  return {
    ...state,
    dayPlacesByGroupId: {
      ...state.dayPlacesByGroupId,
      [activeGroupId]: dayPlaces,
    },
    overlayOps,
  };
}

/** Infer personal overlay day paint from each group's transport legs and stays. */
export function applyGroupInferenceForGroups(
  state: TripSetupState,
  groupIds: Iterable<string>,
): TripSetupState {
  let next = state;
  for (const groupId of groupIds) {
    if (groupId === state.mainGroupId) continue;
    next = applyGroupInference(next, groupId);
  }
  return next;
}

export type TripSetupPersistMode = "full" | "dayPlaces" | "accommodation";

export async function applyTripSetupState(
  tripId: string,
  state: TripSetupState,
  options?: {
    activeGroupId?: string;
    skipWizardItineraryItems?: boolean;
    syncTransportItems?: boolean;
    syncAccommodationItems?: boolean;
    persistMode?: TripSetupPersistMode;
    syncMainAccommodationStays?: boolean;
    affectedDates?: string[];
  },
): Promise<{ dayCount: number }> {
  const persistMode = options?.persistMode ?? "full";
  const activeGroupId = options?.activeGroupId ?? state.mainGroupId;
  const inferred = applyGroupInference(state, activeGroupId);
  const activeDays = inferred.dayPlacesByGroupId[activeGroupId] ?? [];
  const main = mainTransportLegs(inferred);

  if (persistMode !== "full") {
    await syncGroupDayPlaces(tripId, activeGroupId, activeDays);
    await syncOverlayOps(tripId, inferred.overlayOps);

    if (activeGroupId === state.mainGroupId) {
      const affected = options?.affectedDates;
      const daysToPatch = affected?.length
        ? activeDays.filter((d) => affected.includes(d.date))
        : activeDays;
      await syncTripDaysPatch(tripId, daysToPatch, inferred.basics, activeDays);

      if (
        persistMode === "accommodation" ||
        (persistMode === "dayPlaces" && options?.syncMainAccommodationStays)
      ) {
        const allDepartureLegs = [
          ...main.outboundLegs,
          ...main.returnLegs,
          ...main.intercityLegs,
        ];
        const accommodationStays = reconcileImportedAccommodationStays(
          main.accommodationStays,
          allDepartureLegs,
        );
        await syncAccommodationStays(tripId, state.mainGroupId, accommodationStays);
      }
    } else if (persistMode === "accommodation") {
      const groupStays = inferred.accommodationStays.filter(
        (s) => s.originGroupId === activeGroupId,
      );
      await syncGroupAccommodationStays(tripId, activeGroupId, groupStays);
    }

    return { dayCount: activeDays.length };
  }

  // Always sync main transport so removed legs are purged from Neon even when
  // saving from a subgroup context or before other group-scoped writes run.
  await syncTransportProductsTable(tripId, inferred.transportProducts ?? []);
  await syncTransportLegsTable(
    tripId,
    state.mainGroupId,
    main.outboundLegs,
    main.returnLegs,
    main.intercityLegs,
  );

  await syncGroupDayPlaces(tripId, activeGroupId, activeDays);
  await syncOverlayOps(tripId, inferred.overlayOps);

  if (activeGroupId === state.mainGroupId) {
    const allDepartureLegs = [
      ...main.outboundLegs,
      ...main.returnLegs,
      ...main.intercityLegs,
    ];
    const accommodationStays = reconcileImportedAccommodationStays(
      main.accommodationStays,
      allDepartureLegs,
    );

    return applyTripLocationState(
      tripId,
      {
        basics: inferred.basics,
        dayPlaces: activeDays,
        outboundLegs: main.outboundLegs,
        returnLegs: main.returnLegs,
        intercityLegs: main.intercityLegs,
        accommodationStays,
        transportProducts: inferred.transportProducts ?? [],
      },
      {
        syncTransportItems:
          options?.syncTransportItems ??
          (options?.skipWizardItineraryItems ? false : true),
        syncAccommodationItems: options?.syncAccommodationItems,
      },
    );
  }

  const groupLegs = inferred.intercityLegs.filter((l) => l.originGroupId === activeGroupId);
  const groupStays = inferred.accommodationStays.filter((s) => s.originGroupId === activeGroupId);
  await syncGroupIntercityLegs(tripId, activeGroupId, groupLegs);
  await syncGroupAccommodationStays(tripId, activeGroupId, groupStays);

  return { dayCount: activeDays.length };
}

/** Persist intercity legs for every personal group in the batch (not just activeGroupId). */
export async function syncIntercityLegsForGroups(
  tripId: string,
  state: TripSetupState,
  groupIds: Iterable<string>,
): Promise<void> {
  const mainGroupId = state.mainGroupId;
  for (const groupId of groupIds) {
    if (groupId === mainGroupId) continue;
    const groupLegs = state.intercityLegs.filter((l) => l.originGroupId === groupId);
    await syncGroupIntercityLegs(tripId, groupId, groupLegs);
  }
}

/** Persist day places for every group in a batch (party fan-out, not just activeGroupId). */
export async function syncGroupDayPlacesForGroups(
  tripId: string,
  state: TripSetupState,
  groupIds: Iterable<string>,
): Promise<void> {
  for (const groupId of groupIds) {
    const days = state.dayPlacesByGroupId[groupId] ?? [];
    await syncGroupDayPlaces(tripId, groupId, days);
  }
}

/** Drop a subgroup/personal plan's overrides in DB without touching main group data. */
export async function persistResetGroupFromMain(
  tripId: string,
  groupId: string,
): Promise<void> {
  await syncGroupDayPlaces(tripId, groupId, []);
  await syncGroupIntercityLegs(tripId, groupId, []);
  await syncGroupAccommodationStays(tripId, groupId, []);

  await db
    .delete(groupOverlayOps)
    .where(and(eq(groupOverlayOps.tripId, tripId), eq(groupOverlayOps.groupId, groupId)));

  await db
    .delete(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        eq(itineraryItems.originGroupId, groupId),
        eq(itineraryItems.wizardSource, "activity"),
      ),
    );

  await db
    .update(groups)
    .set({ inheritMode: null })
    .where(and(eq(groups.tripId, tripId), eq(groups.id, groupId)));
}
