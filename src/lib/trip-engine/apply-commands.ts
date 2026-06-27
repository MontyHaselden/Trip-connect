import { applySetupAccommodationChange } from "@/lib/host/setup/apply-setup-accommodation";
import { applyGroupInference } from "@/lib/host/setup/apply-setup-state";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { enforceGroupHalfDayBoundaries } from "@/lib/host/setup/enforce-content-half-days";
import {
  classifyImportedFlightChain,
  mergeClassifiedLegsIntoState,
} from "@/lib/host/setup/classify-flight-legs";
import { clearCalendarContentInRange } from "@/lib/host/setup/clear-day-content";
import {
  removeAccommodationAndCitiesFromRange,
  trimConflictingStaysForLocationPaint,
  trimNamedStaysOverlappingIncoming,
} from "@/lib/host/setup/remove-accommodation-range";
import { mergeAccommodationStays } from "@/lib/host/setup/entity-scope";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import {
  applyTripDateRange,
  shiftTripByMonths,
  shiftTripDates,
} from "@/lib/host/setup/set-trip-date-range";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { mergeSetDayPlacesDays } from "./sanitize-day-place";
import { paintLocationDayRange, paintLocationDayRangeProtected } from "./paint-day-range";
import {
  extractPersonalLocationOverlayDelta,
  mergeMainWithPersonalOverlay,
} from "./personal-location-overlay";
import { personalGroupForGroupId } from "./person-lens";
import { pruneStalePersonalTransportLegs } from "./prune-stale-personal-transport-legs";
import { normalizeCommand, type TripCommand } from "./commands";
import { graphToSetupState } from "./adapters";
import { repairTransportGraphSync } from "./repair-transport-graph";
import { pendingTransportNeedKey } from "./hidden-pending-transport";
import type { CommandResult, EngineConflict, EngineWarning, TripEntityGraph } from "./types";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { TransportProductDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

function mergeGraphState(graph: TripEntityGraph, state: TripSetupState): TripEntityGraph {
  return {
    ...state,
    tripId: graph.tripId,
    bookingsSummary: graph.bookingsSummary,
    emergencySummary: graph.emergencySummary,
    publishSummary: graph.publishSummary,
    hiddenPendingTransportNeedKeys: graph.hiddenPendingTransportNeedKeys,
    transportProducts: state.transportProducts ?? graph.transportProducts ?? [],
  };
}

function finalizeTransportChange(
  graph: TripEntityGraph,
  derived: TripSetupState,
): TripEntityGraph {
  return mergeGraphState(graph, syncTripBoundsFromContent(derived));
}

function inferPersonalGroupTransportCalendar(
  graph: TripEntityGraph,
  groupId: string,
): TripEntityGraph {
  if (groupId === graph.mainGroupId) return graph;
  return mergeGraphState(graph, applyGroupInference(graphToSetupState(graph), groupId));
}

function warn(id: string, message: string, section = "general"): EngineWarning {
  return { id, severity: "warning", section, message };
}

function ok(graph: TripEntityGraph, warnings: EngineWarning[] = []): CommandResult {
  return { graph: { ...graph, tripId: graph.tripId }, warnings, conflicts: [] };
}

function dropUnnamedStaysOverlappingNamed(
  stays: TripEntityGraph["accommodationStays"],
  incoming: TripEntityGraph["accommodationStays"][number],
): TripEntityGraph["accommodationStays"] {
  if (!incoming.name?.trim()) return stays;
  return stays.filter((stay) => {
    if (stay.name?.trim()) return true;
    const overlaps =
      stay.checkInDate < incoming.checkOutDate && incoming.checkInDate < stay.checkOutDate;
    return !overlaps;
  });
}

function dayHasPaint(day: { primaryCity: string; secondaryCity?: string | null }): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

/** Keep location paint outside the edited range; replace days inside the range. */
function mergeLocationPaintIntoGroup(
  existing: DayPlaceDraft[],
  painted: DayPlaceDraft[],
  rangeStart: string,
  rangeEnd: string,
): DayPlaceDraft[] {
  const end = rangeEnd || rangeStart;
  const paintedByDate = new Map(painted.map((day) => [day.date, day]));
  const byDate = new Map(existing.map((day) => [day.date, day]));

  for (const date of enumerateDates(rangeStart, end)) {
    const next = paintedByDate.get(date);
    if (next) {
      byDate.set(date, next);
      continue;
    }
    byDate.delete(date);
  }

  return [...byDate.values()]
    .filter((day) => dayHasPaint(day))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function applyPersonalCalendarSideEffects(
  graph: TripEntityGraph,
  groupId: string,
): TripEntityGraph {
  if (!personalGroupForGroupId(graph, groupId)) return graph;
  return pruneStalePersonalTransportLegs(graph, groupId);
}

function applyPersonalLocationPaint(
  graph: TripEntityGraph,
  groupId: string,
  painted: ReturnType<typeof paintLocationDayRange>,
): TripEntityGraph {
  const personal = personalGroupForGroupId(graph, groupId);
  const groups =
    personal && !personal.inheritMode && painted.some(dayHasPaint)
      ? graph.groups.map((g) =>
          g.id === groupId ? { ...g, inheritMode: "overlay" as const } : g,
        )
      : graph.groups;

  return {
    ...graph,
    groups,
    dayPlacesByGroupId: { ...graph.dayPlacesByGroupId, [groupId]: painted },
  };
}

function detachLegFromProduct<T extends { transportProductId?: string | null; billingMode?: string }>(
  leg: T,
  productId: string,
): T {
  if (leg.transportProductId !== productId) return leg;
  return {
    ...leg,
    transportProductId: null,
    billingMode: "single",
  };
}

function applySingleCommand(graph: TripEntityGraph, raw: TripCommand): CommandResult {
  const command = normalizeCommand(raw as TripCommand & { type: string });
  graph = { ...graph, transportProducts: graph.transportProducts ?? [] };
  const warnings: EngineWarning[] = [];
  const conflicts: EngineConflict[] = [];

  switch (command.type) {
    case "updateBasics": {
      // Explicit basics edits must not be wiped by content-bound sync on an empty trip.
      return ok(
        {
          ...graph,
          basics: { ...graph.basics, ...command.basics },
        },
        warnings,
      );
    }

    case "setTripDateRange": {
      const next = applyTripDateRange(graph, {
        startDate: command.startDate,
        endDate: command.endDate,
      });
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "shiftTripDates": {
      const next =
        command.deltaMonths != null && command.deltaMonths !== 0
          ? shiftTripByMonths(graph, command.deltaMonths)
          : shiftTripDates(graph, command.deltaDays ?? 0);
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "addStay": {
      const groupId = command.groupId;
      const stay = { ...command.stay, originGroupId: command.stay.originGroupId ?? groupId };
      const withoutOrphans = dropUnnamedStaysOverlappingNamed(graph.accommodationStays, stay);
      const trimmed = command.replaceLocationLabels
        ? trimNamedStaysOverlappingIncoming(
            withoutOrphans,
            stay,
            groupId,
            graph.mainGroupId,
          )
        : withoutOrphans;
      let nextGraph: TripEntityGraph = {
        ...graph,
        accommodationStays: [...trimmed, stay],
      };
      const replaceStayIds = command.replaceLocationLabels
        ? new Set([stay.id])
        : undefined;
      const next = applySetupAccommodationChange(
        nextGraph,
        groupId,
        replaceStayIds ? { replaceStayIds } : undefined,
      );
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "updateStay": {
      const idx = graph.accommodationStays.findIndex((s) => s.id === command.stayId);
      if (idx < 0) {
        warnings.push(warn("stay-missing", `Stay ${command.stayId} not found`, "accommodation"));
        return { graph, warnings, conflicts };
      }
      const existing = graph.accommodationStays[idx]!;
      const groupId = command.groupId ?? existing.originGroupId ?? graph.mainGroupId;
      const updated = { ...existing, ...command.patch };
      const otherStays = graph.accommodationStays.filter((s) => s.id !== command.stayId);
      const trimmedOthers = command.replaceLocationLabels
        ? trimNamedStaysOverlappingIncoming(otherStays, updated, groupId, graph.mainGroupId)
        : otherStays;
      const stays = [...trimmedOthers, updated];
      let nextGraph: TripEntityGraph = { ...graph, accommodationStays: stays };
      const replaceStayIds = command.replaceLocationLabels
        ? new Set([command.stayId])
        : undefined;
      const next = applySetupAccommodationChange(
        nextGraph,
        groupId,
        replaceStayIds ? { replaceStayIds } : undefined,
      );
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "removeStay": {
      const stay = graph.accommodationStays.find((s) => s.id === command.stayId);
      if (!stay) {
        warnings.push(warn("stay-missing", `Stay ${command.stayId} not found`, "accommodation"));
        return { graph, warnings, conflicts };
      }
      const groupId = command.groupId ?? stay.originGroupId ?? graph.mainGroupId;
      const stays = graph.accommodationStays.filter((s) => s.id !== command.stayId);
      const next = applySetupAccommodationChange({ ...graph, accommodationStays: stays }, groupId);
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "addClassifiedTransportLegs": {
      if (!command.legs.length) return ok(graph, warnings);

      const legsWithGroup = command.legs.map((leg) => ({
        ...leg,
        originGroupId: leg.originGroupId ?? command.groupId,
        intercityFromCity: leg.intercityFromCity || leg.fromCity.trim(),
        intercityToCity: leg.intercityToCity || leg.toCity.trim(),
      }));
      const classified = classifyImportedFlightChain(legsWithGroup, graph);
      const merged = mergeClassifiedLegsIntoState(graph, classified);
      const intercityLegs = merged.intercityLegs.map((leg) => ({
        ...leg,
        originGroupId: leg.originGroupId ?? command.groupId,
      }));
      const next: TripEntityGraph = {
        ...graph,
        outboundLegs: merged.outboundLegs,
        returnLegs: merged.returnLegs,
        intercityLegs,
      };
      const derived = applySetupTransportChange(
        next,
        {
          outboundLegs: next.outboundLegs,
          returnLegs: next.returnLegs,
          intercityLegs: next.intercityLegs,
        },
        { preserveCalendarPaint: true },
      );
      const finalized = finalizeTransportChange(next, derived);
      return ok(inferPersonalGroupTransportCalendar(finalized, command.groupId), warnings);
    }

    case "addTransportLeg": {
      const leg = {
        ...command.leg,
        originGroupId:
          ("originGroupId" in command.leg ? command.leg.originGroupId : null) ??
          (command.bucket === "intercity" ? command.groupId : graph.mainGroupId),
      };
      let next: TripEntityGraph = graph;
      if (command.bucket === "outbound") {
        next = { ...graph, outboundLegs: [...graph.outboundLegs, leg as typeof graph.outboundLegs[0]] };
      } else if (command.bucket === "return") {
        next = { ...graph, returnLegs: [...graph.returnLegs, leg as typeof graph.returnLegs[0]] };
      } else {
        next = { ...graph, intercityLegs: [...graph.intercityLegs, leg as typeof graph.intercityLegs[0]] };
      }
      const derived = applySetupTransportChange(
        next,
        {
          outboundLegs: next.outboundLegs,
          returnLegs: next.returnLegs,
          intercityLegs: next.intercityLegs,
        },
        { preserveCalendarPaint: true },
      );
      return ok(finalizeTransportChange(next, derived), warnings);
    }

    case "updateTransportLeg": {
      const bucket = command.bucket;
      const listKey =
        bucket === "outbound" ? "outboundLegs" : bucket === "return" ? "returnLegs" : "intercityLegs";
      const legs = graph[listKey];
      const idx = legs.findIndex((l) => l.id === command.legId);
      if (idx < 0) {
        warnings.push(warn("leg-missing", `Leg ${command.legId} not found`, "transport"));
        return { graph, warnings, conflicts };
      }
      const current = legs[idx];
      let updatedLeg = { ...current, ...command.patch } as typeof current;
      const targetBucket = command.targetBucket ?? bucket;

      if (targetBucket === "intercity" && bucket !== "intercity") {
        const ic = updatedLeg as typeof graph.intercityLegs[number];
        updatedLeg = {
          ...updatedLeg,
          intercityFromCity: ic.intercityFromCity?.trim() || updatedLeg.fromCity || "",
          intercityToCity: ic.intercityToCity?.trim() || updatedLeg.toCity || "",
          originGroupId: command.groupId,
        } as typeof updatedLeg;
      }

      let next: TripEntityGraph;
      if (targetBucket !== bucket) {
        const targetKey =
          targetBucket === "outbound"
            ? "outboundLegs"
            : targetBucket === "return"
              ? "returnLegs"
              : "intercityLegs";
        next = {
          ...graph,
          [listKey]: legs.filter((_, i) => i !== idx),
          [targetKey]: [...graph[targetKey], updatedLeg],
        } as TripEntityGraph;
      } else {
        const updated = legs.map((l, i) => (i === idx ? updatedLeg : l));
        next = { ...graph, [listKey]: updated } as TripEntityGraph;
      }

      const derived = applySetupTransportChange(
        next,
        {
          outboundLegs: next.outboundLegs,
          returnLegs: next.returnLegs,
          intercityLegs: next.intercityLegs,
        },
        { preserveCalendarPaint: true },
      );
      return ok(finalizeTransportChange(next, derived), warnings);
    }

    case "removeTransportLeg": {
      const bucket = command.bucket;
      const listKey =
        bucket === "outbound" ? "outboundLegs" : bucket === "return" ? "returnLegs" : "intercityLegs";
      const legs = graph[listKey].filter((l) => l.id !== command.legId);
      const next = { ...graph, [listKey]: legs } as TripEntityGraph;
      const derived = applySetupTransportChange(
        next,
        {
          outboundLegs: next.outboundLegs,
          returnLegs: next.returnLegs,
          intercityLegs: next.intercityLegs,
        },
        { preserveCalendarPaint: true },
      );
      return ok(finalizeTransportChange(next, derived), warnings);
    }

    case "addTransportProduct": {
      const product: TransportProductDraft = {
        ...command.product,
        id: command.product.id || newId(),
        participantIds: command.product.participantIds ?? [],
      };
      return ok(
        {
          ...graph,
          transportProducts: [...(graph.transportProducts ?? []), product],
        },
        warnings,
      );
    }

    case "updateTransportProduct": {
      const products = (graph.transportProducts ?? []).map((product) =>
        product.id === command.productId ? { ...product, ...command.patch } : product,
      );
      if (!products.some((product) => product.id === command.productId)) {
        warnings.push(
          warn("product-missing", `Transport product ${command.productId} not found`, "transport"),
        );
        return { graph, warnings, conflicts };
      }
      return ok({ ...graph, transportProducts: products }, warnings);
    }

    case "removeTransportProduct": {
      const products = (graph.transportProducts ?? []).filter(
        (product) => product.id !== command.productId,
      );
      const detach = <T extends { transportProductId?: string | null; billingMode?: string }>(
        leg: T,
      ) => detachLegFromProduct(leg, command.productId);
      return ok(
        {
          ...graph,
          transportProducts: products,
          outboundLegs: graph.outboundLegs.map(detach),
          returnLegs: graph.returnLegs.map(detach),
          intercityLegs: graph.intercityLegs.map(detach),
        },
        warnings,
      );
    }

    case "paintDayRange": {
      const {
        groupId,
        rangeStart,
        rangeEnd,
        location,
        startHalf = "full",
        endHalf = "full",
        replan = false,
      } = command;
      if (!location.trim()) {
        warnings.push(warn("paint-empty", "Location name required", "locations"));
        return { graph, warnings, conflicts };
      }
      const endDate = rangeEnd || rangeStart;

      if (personalGroupForGroupId(graph, groupId)) {
        const personal = personalGroupForGroupId(graph, groupId)!;
        const paintedArgs = [
          rangeStart,
          endDate,
          location.trim(),
          startHalf,
          endHalf,
        ] as const;

        if (personal.inheritMode === "independent") {
          const dayPlaces = graph.dayPlacesByGroupId[groupId] ?? [];
          const painted = paintLocationDayRangeProtected(dayPlaces, ...paintedArgs);
          const merged = mergeLocationPaintIntoGroup(
            dayPlaces,
            painted,
            rangeStart,
            endDate,
          );
          return ok(
            mergeGraphState(
              graph,
              applyPersonalCalendarSideEffects(
                {
                  ...graph,
                  dayPlacesByGroupId: { ...graph.dayPlacesByGroupId, [groupId]: merged },
                },
                groupId,
              ),
            ),
            warnings,
          );
        }

        const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
        const base = mergeMainWithPersonalOverlay(graph, groupId);
        const painted = paintLocationDayRangeProtected(base, ...paintedArgs);
        const overlayOnly = extractPersonalLocationOverlayDelta(
          mainDays,
          painted,
          graph.dayPlacesByGroupId[groupId] ?? [],
          rangeStart,
          endDate,
        );
        return ok(
          mergeGraphState(
            graph,
            applyPersonalCalendarSideEffects(
              applyPersonalLocationPaint(graph, groupId, overlayOnly),
              groupId,
            ),
          ),
          warnings,
        );
      }

      const dayPlaces = graph.dayPlacesByGroupId[groupId] ?? [];
      const painted = paintLocationDayRangeProtected(
        dayPlaces,
        rangeStart,
        endDate,
        location.trim(),
        startHalf,
        endHalf,
      );

      const needsReplan = replan === true;

      if (!needsReplan) {
        return ok(
          {
            ...graph,
            dayPlacesByGroupId: { ...graph.dayPlacesByGroupId, [groupId]: painted },
          },
          warnings,
        );
      }

      const scopedStays = graph.accommodationStays.filter((stay) =>
        groupId === graph.mainGroupId
          ? !stay.originGroupId || stay.originGroupId === graph.mainGroupId
          : stay.originGroupId === groupId,
      );
      const trimmedStays = trimConflictingStaysForLocationPaint(
        scopedStays,
        location.trim(),
        rangeStart,
        endDate,
      );
      const next = syncTripBoundsFromContent({
        ...graph,
        accommodationStays: mergeAccommodationStays(graph, groupId, trimmedStays),
        dayPlacesByGroupId: { ...graph.dayPlacesByGroupId, [groupId]: painted },
      });
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "clearDayRange": {
      const {
        groupId,
        rangeStart,
        rangeEnd,
        startHalf = "full",
        endHalf = "full",
      } = command;
      const synced = clearCalendarContentInRange(
        graph,
        { rangeStart, rangeEnd: rangeEnd || rangeStart, startHalf, endHalf },
        groupId,
      );
      return ok(mergeGraphState(graph, synced), warnings);
    }

    case "setDayPlaces": {
      if (personalGroupForGroupId(graph, command.groupId)) {
        const personal = personalGroupForGroupId(graph, command.groupId)!;

        if (personal.inheritMode === "independent") {
          const existing = graph.dayPlacesByGroupId[command.groupId] ?? [];
          const merged = mergeSetDayPlacesDays(existing, command.days);
          const next = syncTripBoundsFromContent({
            ...graph,
            dayPlacesByGroupId: {
              ...graph.dayPlacesByGroupId,
              [command.groupId]: merged,
            },
          });
          return ok(
            applyPersonalCalendarSideEffects(
              mergeGraphState(graph, next),
              command.groupId,
            ),
            warnings,
          );
        }

        const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
        const dates = command.days.map((d) => d.date).filter(Boolean);
        const rangeStart = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : "";
        const rangeEnd = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "";
        const overlayOnly = extractPersonalLocationOverlayDelta(
          mainDays,
          command.days,
          graph.dayPlacesByGroupId[command.groupId] ?? [],
          rangeStart,
          rangeEnd,
        );
        return ok(
          mergeGraphState(
            graph,
            applyPersonalCalendarSideEffects(
              applyPersonalLocationPaint(graph, command.groupId, overlayOnly),
              command.groupId,
            ),
          ),
          warnings,
        );
      }

      const synced = enforceGroupHalfDayBoundaries(
        {
          ...graph,
          dayPlacesByGroupId: {
            ...graph.dayPlacesByGroupId,
            [command.groupId]: command.days,
          },
        },
        command.groupId,
      );
      const next = syncTripBoundsFromContent(synced);
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "addActivity": {
      const activity = {
        ...command.activity,
        originGroupId: command.activity.originGroupId ?? command.groupId,
      };
      return ok(
        { ...graph, activities: [...graph.activities, activity] },
        warnings,
      );
    }

    case "updateActivity": {
      const idx = graph.activities.findIndex((a) => a.id === command.activityId);
      if (idx < 0) {
        warnings.push(warn("activity-missing", `Activity ${command.activityId} not found`, "activities"));
        return { graph, warnings, conflicts };
      }
      const activities = graph.activities.map((a, i) =>
        i === idx ? { ...a, ...command.patch } : a,
      );
      return ok({ ...graph, activities }, warnings);
    }

    case "removeActivity": {
      return ok(
        {
          ...graph,
          activities: graph.activities.filter((a) => a.id !== command.activityId),
        },
        warnings,
      );
    }

    case "addGroupDayOverride": {
      return ok({ ...graph, overlayOps: [...graph.overlayOps, command.op] }, warnings);
    }

    case "removeGroupDayOverride": {
      return ok(
        {
          ...graph,
          overlayOps: graph.overlayOps.filter((o) => o.id !== command.opId),
        },
        warnings,
      );
    }

    case "createGroup": {
      const group = {
        id: command.id ?? newId(),
        name: command.name,
        type: command.groupType,
        description: command.description ?? null,
        sortOrder: graph.groups.length,
        isMain: false,
        inheritMode: command.inheritMode ?? null,
        personalForParticipantId: command.personalForParticipantId ?? null,
      };
      return ok(
        {
          ...graph,
          groups: [...graph.groups, group],
          dayPlacesByGroupId: { ...graph.dayPlacesByGroupId, [group.id]: [] },
        },
        warnings,
      );
    }

    case "setGroupInheritMode": {
      const groups = graph.groups.map((g) =>
        g.id === command.groupId
          ? { ...g, inheritMode: command.mode }
          : g,
      );
      return ok({ ...graph, groups }, warnings);
    }

    case "ensurePersonalGroup": {
      const existing = graph.groups.find(
        (g) => g.personalForParticipantId === command.participantId && !g.isMain,
      );
      if (existing) {
        const groups = graph.groups.map((g) =>
          g.id === existing.id ? { ...g, inheritMode: command.mode } : g,
        );
        return ok({ ...graph, groups }, warnings);
      }
      const group = {
        id: newId(),
        name: command.participantName,
        type: "split_travel",
        description: null,
        sortOrder: graph.groups.length,
        isMain: false,
        inheritMode: command.mode,
        personalForParticipantId: command.participantId,
      };
      return ok(
        {
          ...graph,
          groups: [...graph.groups, group],
          dayPlacesByGroupId: { ...graph.dayPlacesByGroupId, [group.id]: [] },
        },
        warnings,
      );
    }

    case "updateGroup": {
      const groups = graph.groups.map((g) =>
        g.id === command.groupId
          ? {
              ...g,
              ...(command.name !== undefined ? { name: command.name } : {}),
              ...(command.groupType !== undefined ? { type: command.groupType } : {}),
              ...(command.description !== undefined ? { description: command.description } : {}),
            }
          : g,
      );
      return ok({ ...graph, groups }, warnings);
    }

    case "deleteGroup": {
      if (command.groupId === graph.mainGroupId) {
        conflicts.push({
          id: "delete-main-group",
          severity: "blocking",
          section: "groups",
          message: "Cannot delete the main group",
        });
        return { graph, warnings, conflicts };
      }
      const { [command.groupId]: _removed, ...restDays } = graph.dayPlacesByGroupId;
      return ok(
        {
          ...graph,
          groups: graph.groups.filter((g) => g.id !== command.groupId),
          dayPlacesByGroupId: restDays,
          accommodationStays: graph.accommodationStays.filter(
            (s) => s.originGroupId !== command.groupId,
          ),
          intercityLegs: graph.intercityLegs.filter((l) => l.originGroupId !== command.groupId),
          overlayOps: graph.overlayOps.filter((o) => o.groupId !== command.groupId),
        },
        warnings,
      );
    }

    case "resetGroupFromMain": {
      if (command.groupId === graph.mainGroupId) {
        warnings.push(warn("reset-main-group", "Main group is already the source plan", "groups"));
        return { graph, warnings, conflicts };
      }
      const group = graph.groups.find((g) => g.id === command.groupId);
      if (!group || group.isMain) {
        conflicts.push({
          id: "reset-unknown-group",
          severity: "blocking",
          section: "groups",
          message: "Cannot reset this group",
        });
        return { graph, warnings, conflicts };
      }
      return ok(
        {
          ...graph,
          groups: graph.groups.map((g) =>
            g.id === command.groupId ? { ...g, inheritMode: null } : g,
          ),
          dayPlacesByGroupId: {
            ...graph.dayPlacesByGroupId,
            [command.groupId]: [],
          },
          accommodationStays: graph.accommodationStays.filter(
            (s) => s.originGroupId !== command.groupId,
          ),
          intercityLegs: graph.intercityLegs.filter((l) => l.originGroupId !== command.groupId),
          activities: graph.activities.filter((a) => a.originGroupId !== command.groupId),
          overlayOps: graph.overlayOps.filter((o) => o.groupId !== command.groupId),
        },
        warnings,
      );
    }

    case "setBookingStatus": {
      if (command.entityType === "transport_leg") {
        const patch = { bookingStatus: command.bookingStatus as typeof graph.outboundLegs[0]["bookingStatus"] };
        return ok(
          {
            ...graph,
            outboundLegs: graph.outboundLegs.map((l) =>
              l.id === command.entityId ? { ...l, ...patch } : l,
            ),
            returnLegs: graph.returnLegs.map((l) =>
              l.id === command.entityId ? { ...l, ...patch } : l,
            ),
            intercityLegs: graph.intercityLegs.map((l) =>
              l.id === command.entityId ? { ...l, ...patch } : l,
            ),
          },
          warnings,
        );
      }
      if (command.entityType === "accommodation_stay") {
        return ok(
          {
            ...graph,
            accommodationStays: graph.accommodationStays.map((s) =>
              s.id === command.entityId
                ? { ...s, stayType: command.bookingStatus === "not_booked" ? "not_booked" : s.stayType }
                : s,
            ),
          },
          warnings,
        );
      }
      return ok(
        {
          ...graph,
          activities: graph.activities.map((a) =>
            a.id === command.entityId
              ? { ...a, bookingStatus: command.bookingStatus as typeof a.bookingStatus }
              : a,
          ),
        },
        warnings,
      );
    }

    case "setEmergencyInfo": {
      return ok(
        {
          ...graph,
          emergencySummary: {
            ...graph.emergencySummary,
            ...(command.localEmergencyNumber !== undefined
              ? { localEmergencyNumber: command.localEmergencyNumber }
              : {}),
            ...(command.schoolEmergencyPhone !== undefined
              ? { schoolEmergencyPhone: command.schoolEmergencyPhone }
              : {}),
          },
        },
        warnings,
      );
    }

    case "setViewerSettings": {
      return ok(
        {
          ...graph,
          publishSummary: {
            ...graph.publishSummary,
            ...(command.viewerGalleryEnabled !== undefined
              ? { viewerGalleryEnabled: command.viewerGalleryEnabled }
              : {}),
            ...(command.viewerRoomDetailsEnabled !== undefined
              ? { viewerRoomDetailsEnabled: command.viewerRoomDetailsEnabled }
              : {}),
          },
        },
        warnings,
      );
    }

    case "hidePendingTransportNeed": {
      const key = pendingTransportNeedKey(command.groupId, command.need);
      const keys = new Set(graph.hiddenPendingTransportNeedKeys ?? []);
      keys.add(key);
      return ok({ ...graph, hiddenPendingTransportNeedKeys: [...keys] }, warnings);
    }

    case "unhidePendingTransportNeed": {
      const key = pendingTransportNeedKey(command.groupId, command.need);
      const keys = (graph.hiddenPendingTransportNeedKeys ?? []).filter((k) => k !== key);
      return ok({ ...graph, hiddenPendingTransportNeedKeys: keys }, warnings);
    }

    case "addBookingDetails":
    case "updateBookingDetails": {
      return ok(graph, warnings);
    }

    default: {
      const _exhaustive: never = command;
      return {
        graph,
        warnings: [warn("unknown-command", `Unknown command: ${(_exhaustive as TripCommand).type}`)],
        conflicts,
      };
    }
  }
}

export function applyCommands(graph: TripEntityGraph, commands: TripCommand[]): CommandResult {
  let current = graph;
  const allWarnings: EngineWarning[] = [];
  const allConflicts: EngineConflict[] = [];

  for (const command of commands) {
    const result = applySingleCommand(current, command);
    current = result.graph;
    allWarnings.push(...result.warnings);
    allConflicts.push(...result.conflicts);
  }

  return { graph: repairTransportGraphSync(current), warnings: allWarnings, conflicts: allConflicts };
}

/** Remove accommodation + cities for a date range without clearing transport/activities. */
export function removeRangeFromGraph(
  graph: TripEntityGraph,
  rangeStart: string,
  rangeEnd: string,
  groupId: string,
): TripEntityGraph {
  const next = removeAccommodationAndCitiesFromRange(graph, rangeStart, rangeEnd, groupId, {
    startHalf: "full",
    endHalf: "full",
  });
  return mergeGraphState(graph, syncTripBoundsFromContent(next));
}
