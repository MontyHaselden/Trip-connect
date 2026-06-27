import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { entityBookingDetails, groups, trips } from "@/lib/db/schema";
import {
  applyGroupInferenceForGroups,
  applyTripSetupState,
  persistResetGroupFromMain,
  syncGroupDayPlacesForGroups,
  syncIntercityLegsForGroups,
} from "@/lib/host/setup/apply-setup-state";
import { syncTransportLegsTable } from "@/lib/host/locations/apply-location-state";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import { purgeTransportItineraryForRemovedLeg, reconcileTransportItineraryItems } from "@/lib/host/import/transport-itinerary-reconcile";
import { graphToSetupState } from "./adapters";
import { applyCommands } from "./apply-commands";
import { allGroupIdsFromCommands, groupIdFromCommands } from "./command-group-ids";
import { syncActivitiesForTrip, loadActivitiesForTrip } from "./activities-persistence";
import { mergeActivitiesById } from "./merge-graph-activities";
import { linkCostLineToActivity } from "./cost-ledger/link-cost-line-to-entity";
import {
  hidePendingTransportNeed,
  unhidePendingTransportNeed,
} from "./hidden-pending-transport";
import { loadTripGraph } from "./load-trip-graph";
import { normalizeCommand, type TripCommand } from "./commands";
import { coerceProposedCommands } from "./coerce-proposed-command";
import {
  deleteCostLinesForActivity,
  deleteCostLinesForStay,
  deleteCostLinesForTransportLeg,
  deleteCostLinesForTransportProduct,
} from "./cost-ledger/cost-line-cascade";
import { dayPlacesForGroup } from "./selectors";
import {
  mergeSetDayPlacesDays,
  sanitizeDayPlaceDraft,
} from "./sanitize-day-place";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import type { CommandResult, TripEntityGraph } from "./types";

function findTransportLeg(
  graph: TripEntityGraph,
  legId: string,
  bucket?: "outbound" | "return" | "intercity",
): TransportLegDraft | IntercityLegDraft | undefined {
  if (bucket === "outbound" || !bucket) {
    const leg = graph.outboundLegs.find((l) => l.id === legId);
    if (leg) return leg;
  }
  if (bucket === "return" || !bucket) {
    const leg = graph.returnLegs.find((l) => l.id === legId);
    if (leg) return leg;
  }
  if (bucket === "intercity" || !bucket) {
    const leg = graph.intercityLegs.find((l) => l.id === legId);
    if (leg) return leg;
  }
  return undefined;
}

async function persistGroupCommand(
  tripId: string,
  command: TripCommand,
  graphAfter?: TripEntityGraph,
): Promise<void> {
  if (command.type === "createGroup") {
    const maxSort = await db
      .select({ sortOrder: groups.sortOrder })
      .from(groups)
      .where(eq(groups.tripId, tripId))
      .orderBy(asc(groups.sortOrder))
      .then((rows) => rows[rows.length - 1]?.sortOrder ?? 0);

    await db.insert(groups).values({
      ...(command.id ? { id: command.id } : {}),
      tripId,
      name: command.name,
      type: command.groupType as (typeof groups.$inferInsert)["type"],
      description: command.description ?? null,
      sortOrder: maxSort + 1,
      isMain: false,
      inheritMode: command.inheritMode ?? null,
      personalForParticipantId: command.personalForParticipantId ?? null,
    });
    return;
  }

  if (command.type === "setGroupInheritMode") {
    await db
      .update(groups)
      .set({ inheritMode: command.mode })
      .where(and(eq(groups.tripId, tripId), eq(groups.id, command.groupId)));
    return;
  }

  if (command.type === "ensurePersonalGroup") {
    const graphGroup = graphAfter?.groups.find(
      (g) => g.personalForParticipantId === command.participantId && !g.isMain,
    );
    const existing = await db
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.tripId, tripId),
          eq(groups.personalForParticipantId, command.participantId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      await db
        .update(groups)
        .set({ inheritMode: command.mode })
        .where(eq(groups.id, existing.id));
      return;
    }

    const maxSort = await db
      .select({ sortOrder: groups.sortOrder })
      .from(groups)
      .where(eq(groups.tripId, tripId))
      .orderBy(asc(groups.sortOrder))
      .then((rows) => rows[rows.length - 1]?.sortOrder ?? 0);

    const groupId = graphGroup?.id;
    const [created] = await db
      .insert(groups)
      .values({
        ...(groupId ? { id: groupId } : {}),
        tripId,
        name: command.participantName,
        type: "split_travel",
        description: null,
        sortOrder: maxSort + 1,
        isMain: false,
        inheritMode: command.mode,
        personalForParticipantId: command.participantId,
      })
      .returning({ id: groups.id });

    if (created) {
      const { participantGroups } = await import("@/lib/db/schema");
      await db
        .insert(participantGroups)
        .values({ participantId: command.participantId, groupId: created.id })
        .onConflictDoNothing();
    }
    return;
  }

  if (command.type === "updateGroup") {
    await db
      .update(groups)
      .set({
        ...(command.name !== undefined ? { name: command.name } : {}),
        ...(command.groupType !== undefined
          ? { type: command.groupType as (typeof groups.$inferInsert)["type"] }
          : {}),
        ...(command.description !== undefined ? { description: command.description } : {}),
      })
      .where(and(eq(groups.tripId, tripId), eq(groups.id, command.groupId)));
    return;
  }

  if (command.type === "deleteGroup") {
    await db
      .delete(groups)
      .where(and(eq(groups.tripId, tripId), eq(groups.id, command.groupId), eq(groups.isMain, false)));
  }
}

async function persistBookingCommand(tripId: string, command: TripCommand): Promise<void> {
  if (command.type === "addBookingDetails") {
    await db.insert(entityBookingDetails).values({
      tripId,
      entityType: command.entityType as "transport_leg" | "accommodation_stay" | "itinerary_item",
      entityId: command.entityId,
      bookingStatus: command.bookingStatus as "booked" | "not_booked" | "placeholder" | "flexible",
      supplier: command.supplier ?? null,
      bookingReference: command.bookingReference ?? null,
    });
    return;
  }

  if (command.type === "updateBookingDetails") {
    await db
      .update(entityBookingDetails)
      .set({
        ...(command.patch.bookingStatus
          ? { bookingStatus: command.patch.bookingStatus as "booked" | "not_booked" | "placeholder" | "flexible" }
          : {}),
        ...(command.patch.supplier !== undefined ? { supplier: command.patch.supplier } : {}),
        ...(command.patch.bookingReference !== undefined
          ? { bookingReference: command.patch.bookingReference }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(entityBookingDetails.id, command.bookingId));
  }
}

async function persistTripMetaCommand(tripId: string, command: TripCommand): Promise<void> {
  if (command.type === "setEmergencyInfo") {
    await db
      .update(trips)
      .set({
        ...(command.localEmergencyNumber !== undefined
          ? { localEmergencyNumber: command.localEmergencyNumber }
          : {}),
        ...(command.schoolEmergencyPhone !== undefined
          ? { schoolEmergencyPhone: command.schoolEmergencyPhone }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));
    return;
  }

  if (command.type === "setViewerSettings") {
    await db
      .update(trips)
      .set({
        ...(command.viewerGalleryEnabled !== undefined
          ? { viewerGalleryEnabled: command.viewerGalleryEnabled }
          : {}),
        ...(command.viewerRoomDetailsEnabled !== undefined
          ? { viewerRoomDetailsEnabled: command.viewerRoomDetailsEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));
  }
}

function isResetGroupFromMainCommand(command: TripCommand): boolean {
  return command.type === "resetGroupFromMain";
}

function isMetaCommand(command: TripCommand): boolean {
  return (
    command.type === "createGroup" ||
    command.type === "setGroupInheritMode" ||
    command.type === "ensurePersonalGroup" ||
    command.type === "updateGroup" ||
    command.type === "deleteGroup" ||
    command.type === "addBookingDetails" ||
    command.type === "updateBookingDetails" ||
    command.type === "setEmergencyInfo" ||
    command.type === "setViewerSettings" ||
    command.type === "hidePendingTransportNeed" ||
    command.type === "unhidePendingTransportNeed"
  );
}

function groupIdFromCommand(command: TripCommand): string | undefined {
  if ("groupId" in command && typeof command.groupId === "string") return command.groupId;
  return undefined;
}

export { groupIdFromCommands, allGroupIdsFromCommands } from "./command-group-ids";

function isAccommodationCalendarCommand(command: TripCommand): boolean {
  return (
    command.type === "addStay" ||
    command.type === "updateStay" ||
    command.type === "removeStay" ||
    command.type === "paintDayRange" ||
    command.type === "setDayPlaces" ||
    command.type === "clearDayRange"
  );
}

function isAccommodationOnlyBatch(commands: TripCommand[]): boolean {
  return commands.length > 0 && commands.every(isAccommodationCalendarCommand);
}

const TRANSPORT_ITINERARY_SYNC_COMMANDS = new Set<TripCommand["type"]>([
  "addTransportLeg",
  "addClassifiedTransportLegs",
  "updateTransportLeg",
  "removeTransportLeg",
]);

function commandsNeedTransportItinerarySync(commands: TripCommand[]): boolean {
  return commands.some((c) => TRANSPORT_ITINERARY_SYNC_COMMANDS.has(c.type));
}

function isBasicsOnlyCommand(command: TripCommand): boolean {
  return command.type === "updateBasics";
}

function isDayPlacesOnlyCommand(command: TripCommand): boolean {
  return command.type === "paintDayRange" || command.type === "setDayPlaces";
}

function isDayPlacesOnlyBatch(commands: TripCommand[]): boolean {
  return commands.length > 0 && commands.every(isDayPlacesOnlyCommand);
}

function isAccommodationStayCommand(command: TripCommand): boolean {
  return (
    command.type === "addStay" ||
    command.type === "updateStay" ||
    command.type === "removeStay"
  );
}

function isAccommodationStayBatch(commands: TripCommand[]): boolean {
  return commands.length > 0 && commands.every(isAccommodationStayCommand);
}

function affectedDatesFromCommands(commands: TripCommand[]): string[] {
  const dates = new Set<string>();
  for (const command of commands) {
    if (command.type === "setDayPlaces") {
      for (const day of command.days) {
        if (day.date) dates.add(day.date);
      }
    } else if (
      command.type === "paintDayRange" ||
      command.type === "clearDayRange"
    ) {
      for (const iso of enumerateDates(
        command.rangeStart,
        command.rangeEnd || command.rangeStart,
      )) {
        dates.add(iso);
      }
    }
  }
  return [...dates];
}

function calendarCommandsNeedStaySync(commands: TripCommand[]): boolean {
  return commands.some(
    (c) =>
      c.type === "clearDayRange" ||
      c.type === "addStay" ||
      c.type === "updateStay" ||
      c.type === "removeStay" ||
      (c.type === "paintDayRange" && c.replan === true),
  );
}

function calendarCommandsNeedTransportSync(commands: TripCommand[]): boolean {
  return commands.some((c) => c.type === "clearDayRange");
}

function calendarCommandsNeedActivitySync(commands: TripCommand[]): boolean {
  return commands.some((c) => c.type === "clearDayRange");
}

/** Label-only calendar edits — safe to skip full engine response round-trip. */
export function isCalendarLabelsOnlyBatch(commands: TripCommand[]): boolean {
  return (
    commands.length > 0 &&
    commands.every(
      (c) =>
        (c.type === "paintDayRange" && c.replan !== true) ||
        c.type === "setDayPlaces",
    )
  );
}

async function persistAccommodationCalendarBatch(
  tripId: string,
  graph: TripEntityGraph,
  commands: TripCommand[],
  activeGroupId: string,
): Promise<void> {
  const affectedDates = affectedDatesFromCommands(commands);
  const syncStays = calendarCommandsNeedStaySync(commands);
  const syncTransport = calendarCommandsNeedTransportSync(commands);
  const syncActivities = calendarCommandsNeedActivitySync(commands);
  const isMain = activeGroupId === graph.mainGroupId;
  const persistMode =
    !isMain && syncStays ? ("accommodation" as const) : ("dayPlaces" as const);

  await applyTripSetupState(tripId, graphToSetupState(graph), {
    activeGroupId,
    persistMode,
    affectedDates:
      persistMode === "dayPlaces" && affectedDates.length ? affectedDates : undefined,
    syncMainAccommodationStays: syncStays && isMain,
  });

  if (syncTransport && isMain) {
    await syncTransportLegsTable(
      tripId,
      graph.mainGroupId,
      graph.outboundLegs,
      graph.returnLegs,
      graph.intercityLegs,
    );
  }
  if (syncActivities) {
    await syncActivitiesForTrip(tripId, graph.activities);
  }
}

async function persistBasicsCommand(tripId: string, basics: TripEntityGraph["basics"]): Promise<void> {
  const countries = basics.destinationCountries.filter(Boolean).join(", ") || null;
  await db
    .update(trips)
    .set({
      name: basics.name.trim(),
      schoolName: basics.schoolName.trim(),
      startDate: basics.startDate,
      endDate: basics.endDate,
      timezone: basics.timezone,
      departureCity: basics.departureCity || null,
      returnCity: basics.returnCity || null,
      defaultDepartureAirport: basics.defaultDepartureAirport?.trim() || null,
      destinationCountry: countries,
      updatedAt: new Date(),
    })
    .where(eq(trips.id, tripId));
}

function repairCommandsForPersist(
  commands: TripCommand[],
  graph: TripEntityGraph,
): TripCommand[] {
  return commands.map((command) => {
    if (command.type !== "setDayPlaces") return command;
    const existing = dayPlacesForGroup(graph, command.groupId);
    const incoming = command.days
      .filter((day) => Boolean(day?.date))
      .map((day) =>
        sanitizeDayPlaceDraft({
          ...day,
          date: day.date,
          primaryCity: day.primaryCity ?? "",
        }),
      );
    return {
      ...command,
      days: mergeSetDayPlacesDays(existing, incoming),
    };
  });
}

function commandsNeedAuthoritativeGraphReload(commands: TripCommand[]): boolean {
  return commands.some((c) =>
    [
      "addTransportProduct",
      "updateTransportProduct",
      "removeTransportProduct",
      "addTransportLeg",
      "addClassifiedTransportLegs",
      "updateTransportLeg",
      "removeTransportLeg",
    ].includes(c.type),
  );
}

/** Apply commands in memory, persist to DB, reload authoritative graph. */
export async function persistCommands(
  tripId: string,
  graph: TripEntityGraph,
  commands: TripCommand[],
): Promise<CommandResult> {
  const { commands: coerced } = coerceProposedCommands(
    commands as Array<Record<string, unknown>>,
    graph.mainGroupId,
  );
  const normalized = repairCommandsForPersist(
    coerced.map((c) => normalizeCommand(c as TripCommand & { type: string })),
    graph,
  );

  const dbActivities = await loadActivitiesForTrip(tripId);
  const activityAdds = normalized
    .filter((command) => command.type === "addActivity")
    .map((command) => command.activity);
  const workingGraph: TripEntityGraph = {
    ...graph,
    activities: mergeActivitiesById(dbActivities, graph.activities, activityAdds),
  };

  for (const command of normalized) {
    if (command.type === "removeTransportProduct") {
      await deleteCostLinesForTransportProduct(tripId, command.productId);
    }
    if (command.type === "removeTransportLeg") {
      const leg = findTransportLeg(workingGraph, command.legId, command.bucket);
      await purgeTransportItineraryForRemovedLeg(tripId, command.legId, leg);
      await deleteCostLinesForTransportLeg(tripId, command.legId);
    }
    if (command.type === "removeStay") {
      await deleteCostLinesForStay(tripId, command.stayId);
    }
    if (command.type === "removeActivity") {
      await deleteCostLinesForActivity(tripId, command.activityId);
    }
  }

  const result = applyCommands(workingGraph, normalized);

  for (const leg of workingGraph.intercityLegs) {
    if (result.graph.intercityLegs.some((row) => row.id === leg.id)) continue;
    await purgeTransportItineraryForRemovedLeg(tripId, leg.id, leg);
    await deleteCostLinesForTransportLeg(tripId, leg.id);
  }

  for (const command of normalized) {
    if (command.type === "hidePendingTransportNeed") {
      await hidePendingTransportNeed(tripId, command.groupId, command.need);
    }
    if (command.type === "unhidePendingTransportNeed") {
      await unhidePendingTransportNeed(tripId, command.groupId, command.need);
    }
    if (command.type === "resetGroupFromMain") {
      await persistResetGroupFromMain(tripId, command.groupId);
    }
  }

  for (const command of normalized) {
    if (isMetaCommand(command)) {
      if (
        command.type === "createGroup" ||
        command.type === "setGroupInheritMode" ||
        command.type === "ensurePersonalGroup" ||
        command.type === "updateGroup" ||
        command.type === "deleteGroup"
      ) {
        await persistGroupCommand(tripId, command, result.graph);
      } else if (
        command.type === "addBookingDetails" ||
        command.type === "updateBookingDetails"
      ) {
        await persistBookingCommand(tripId, command);
      } else {
        await persistTripMetaCommand(tripId, command);
      }
    }
  }

  const stateCommands = normalized.filter(
    (c) => !isMetaCommand(c) && !isResetGroupFromMainCommand(c),
  );
  if (stateCommands.length > 0) {
    const activeGroupId = groupIdFromCommand(stateCommands[0]!) ?? graph.mainGroupId;
    if (stateCommands.every(isBasicsOnlyCommand)) {
      await persistBasicsCommand(tripId, result.graph.basics);
    } else if (isDayPlacesOnlyBatch(stateCommands)) {
      const setupState = graphToSetupState(result.graph);
      const batchGroupIds = allGroupIdsFromCommands(stateCommands);
      await applyTripSetupState(tripId, setupState, {
        activeGroupId,
        persistMode: "dayPlaces",
        syncMainAccommodationStays: stateCommands.some(
          (c) => c.type === "paintDayRange" && c.replan === true,
        ),
        affectedDates: affectedDatesFromCommands(stateCommands),
      });
      const extraGroupIds = batchGroupIds.filter((id) => id !== activeGroupId);
      if (extraGroupIds.length) {
        await syncGroupDayPlacesForGroups(tripId, setupState, extraGroupIds);
      }
      await syncIntercityLegsForGroups(tripId, setupState, batchGroupIds);
    } else if (isAccommodationStayBatch(stateCommands)) {
      await applyTripSetupState(tripId, graphToSetupState(result.graph), {
        activeGroupId,
        persistMode: "accommodation",
      });
    } else if (isAccommodationOnlyBatch(stateCommands)) {
      await persistAccommodationCalendarBatch(
        tripId,
        result.graph,
        stateCommands,
        activeGroupId,
      );
    } else {
      const syncTransportItems = commandsNeedTransportItinerarySync(stateCommands);
      const batchGroupIds = allGroupIdsFromCommands(stateCommands);
      const setupState = applyGroupInferenceForGroups(
        graphToSetupState(result.graph),
        batchGroupIds,
      );
      await applyTripSetupState(tripId, setupState, {
        activeGroupId,
        skipWizardItineraryItems: true,
        syncTransportItems,
        syncAccommodationItems: false,
      });
      if (syncTransportItems) {
        await syncIntercityLegsForGroups(tripId, setupState, batchGroupIds);
        const personalGroupIds = batchGroupIds.filter((id) => id !== setupState.mainGroupId);
        if (personalGroupIds.length) {
          await syncGroupDayPlacesForGroups(tripId, setupState, personalGroupIds);
        }
      }
      await syncActivitiesForTrip(tripId, result.graph.activities);
      await reconcileTransportItineraryItems(tripId, {
        outboundLegs: result.graph.outboundLegs,
        returnLegs: result.graph.returnLegs,
        intercityLegs: result.graph.intercityLegs,
      });
    }
  }

  if (normalized.some(isResetGroupFromMainCommand)) {
    const reloaded = await loadTripGraph(tripId);
    if (reloaded) {
      return {
        graph: reloaded,
        warnings: result.warnings,
        conflicts: result.conflicts ?? [],
      };
    }
  }

  for (const command of normalized) {
    if (command.type === "addActivity" && command.linkFinanceLineId) {
      await linkCostLineToActivity(
        tripId,
        command.linkFinanceLineId,
        command.activity.id,
        command.activity.date,
      );
    }
  }

  if (stateCommands.length > 0 && commandsNeedAuthoritativeGraphReload(stateCommands)) {
    const reloaded = await loadTripGraph(tripId);
    if (reloaded) {
      return {
        graph: reloaded,
        warnings: result.warnings,
        conflicts: result.conflicts ?? [],
      };
    }
  }

  return {
    graph: result.graph,
    warnings: result.warnings,
    conflicts: result.conflicts ?? [],
  };
}

export async function persistCommand(
  tripId: string,
  graph: TripEntityGraph,
  command: TripCommand,
): Promise<CommandResult> {
  return persistCommands(tripId, graph, [command]);
}
