import { applySetupAccommodationChange } from "@/lib/host/setup/apply-setup-accommodation";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import {
  classifyImportedFlightChain,
  mergeClassifiedLegsIntoState,
} from "@/lib/host/setup/classify-flight-legs";
import { clearCalendarContentInRange } from "@/lib/host/setup/clear-day-content";
import {
  removeAccommodationAndCitiesFromRange,
  trimConflictingStaysForLocationPaint,
} from "@/lib/host/setup/remove-accommodation-range";
import { mergeAccommodationStays } from "@/lib/host/setup/entity-scope";
import { syncTripBoundsFromContent } from "@/lib/host/setup/sync-trip-bounds";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { paintLocationDayRange } from "./paint-day-range";
import { normalizeCommand, type TripCommand } from "./commands";
import type { CommandResult, EngineConflict, EngineWarning, TripEntityGraph } from "./types";
import type { TripSetupState } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";

function mergeGraphState(graph: TripEntityGraph, state: TripSetupState): TripEntityGraph {
  return {
    ...state,
    tripId: graph.tripId,
    bookingsSummary: graph.bookingsSummary,
    emergencySummary: graph.emergencySummary,
    publishSummary: graph.publishSummary,
  };
}

function warn(id: string, message: string, section = "general"): EngineWarning {
  return { id, severity: "warning", section, message };
}

function ok(graph: TripEntityGraph, warnings: EngineWarning[] = []): CommandResult {
  return { graph: { ...graph, tripId: graph.tripId }, warnings, conflicts: [] };
}

function applySingleCommand(graph: TripEntityGraph, raw: TripCommand): CommandResult {
  const command = normalizeCommand(raw as TripCommand & { type: string });
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

    case "addStay": {
      const groupId = command.groupId;
      const stay = { ...command.stay, originGroupId: command.stay.originGroupId ?? groupId };
      const next = applySetupAccommodationChange(
        { ...graph, accommodationStays: [...graph.accommodationStays, stay] },
        groupId,
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
      const stays = graph.accommodationStays.map((s, i) => (i === idx ? updated : s));
      const next = applySetupAccommodationChange({ ...graph, accommodationStays: stays }, groupId);
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
      const derived = applySetupTransportChange(next, {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        intercityLegs: next.intercityLegs,
      });
      return ok(mergeGraphState(graph, syncTripBoundsFromContent(derived)), warnings);
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
      const derived = applySetupTransportChange(next, {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        intercityLegs: next.intercityLegs,
      });
      return ok(mergeGraphState(graph, syncTripBoundsFromContent(derived)), warnings);
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
      const updated = legs.map((l, i) => (i === idx ? { ...l, ...command.patch } : l));
      const next = { ...graph, [listKey]: updated } as TripEntityGraph;
      const derived = applySetupTransportChange(next, {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        intercityLegs: next.intercityLegs,
      });
      return ok(mergeGraphState(graph, syncTripBoundsFromContent(derived)), warnings);
    }

    case "removeTransportLeg": {
      const bucket = command.bucket;
      const listKey =
        bucket === "outbound" ? "outboundLegs" : bucket === "return" ? "returnLegs" : "intercityLegs";
      const legs = graph[listKey].filter((l) => l.id !== command.legId);
      const next = { ...graph, [listKey]: legs } as TripEntityGraph;
      const derived = applySetupTransportChange(next, {
        outboundLegs: next.outboundLegs,
        returnLegs: next.returnLegs,
        intercityLegs: next.intercityLegs,
      });
      return ok(mergeGraphState(graph, syncTripBoundsFromContent(derived)), warnings);
    }

    case "paintDayRange": {
      const { groupId, rangeStart, rangeEnd, location, startHalf = "full", endHalf = "full" } =
        command;
      if (!location.trim()) {
        warnings.push(warn("paint-empty", "Location name required", "locations"));
        return { graph, warnings, conflicts };
      }
      const dayPlaces = graph.dayPlacesByGroupId[groupId] ?? [];
      const endDate = rangeEnd || rangeStart;
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
      const painted = paintLocationDayRange(
        dayPlaces,
        rangeStart,
        endDate,
        location.trim(),
        startHalf,
        endHalf,
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
      const next = syncTripBoundsFromContent({
        ...graph,
        dayPlacesByGroupId: {
          ...graph.dayPlacesByGroupId,
          [command.groupId]: command.days,
        },
      });
      return ok(mergeGraphState(graph, next), warnings);
    }

    case "addActivity": {
      return ok(
        { ...graph, activities: [...graph.activities, command.activity] },
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
        id: newId(),
        name: command.name,
        type: command.groupType,
        description: command.description ?? null,
        sortOrder: graph.groups.length,
        isMain: false,
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

  return { graph: current, warnings: allWarnings, conflicts: allConflicts };
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
