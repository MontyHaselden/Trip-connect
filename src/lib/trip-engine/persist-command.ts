import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { entityBookingDetails, groups, trips } from "@/lib/db/schema";
import { applyTripSetupState } from "@/lib/host/setup/apply-setup-state";
import { purgeTransportItineraryForRemovedLeg, reconcileTransportItineraryItems } from "@/lib/host/import/transport-itinerary-reconcile";
import { graphToSetupState } from "./adapters";
import { applyCommands } from "./apply-commands";
import { syncActivitiesForTrip } from "./activities-persistence";
import { normalizeCommand, type TripCommand } from "./commands";
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

async function persistGroupCommand(tripId: string, command: TripCommand): Promise<void> {
  if (command.type === "createGroup") {
    const maxSort = await db
      .select({ sortOrder: groups.sortOrder })
      .from(groups)
      .where(eq(groups.tripId, tripId))
      .orderBy(asc(groups.sortOrder))
      .then((rows) => rows[rows.length - 1]?.sortOrder ?? 0);

    await db.insert(groups).values({
      tripId,
      name: command.name,
      type: command.groupType as (typeof groups.$inferInsert)["type"],
      description: command.description ?? null,
      sortOrder: maxSort + 1,
      isMain: false,
    });
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

function isMetaCommand(command: TripCommand): boolean {
  return (
    command.type === "createGroup" ||
    command.type === "updateGroup" ||
    command.type === "deleteGroup" ||
    command.type === "addBookingDetails" ||
    command.type === "updateBookingDetails" ||
    command.type === "setEmergencyInfo" ||
    command.type === "setViewerSettings"
  );
}

function groupIdFromCommand(command: TripCommand): string | undefined {
  if ("groupId" in command && typeof command.groupId === "string") return command.groupId;
  return undefined;
}

const TRANSPORT_ITINERARY_SYNC_COMMANDS = new Set<TripCommand["type"]>([
  "addTransportLeg",
  "addClassifiedTransportLegs",
  "updateTransportLeg",
  "addLeg",
  "updateLeg",
]);

function commandsNeedTransportItinerarySync(commands: TripCommand[]): boolean {
  return commands.some((c) => TRANSPORT_ITINERARY_SYNC_COMMANDS.has(c.type));
}

function isBasicsOnlyCommand(command: TripCommand): boolean {
  return command.type === "updateBasics";
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

/** Apply commands in memory, persist to DB, reload authoritative graph. */
export async function persistCommands(
  tripId: string,
  graph: TripEntityGraph,
  commands: TripCommand[],
): Promise<CommandResult> {
  const normalized = commands.map((c) => normalizeCommand(c as TripCommand & { type: string }));

  for (const command of normalized) {
    if (command.type === "removeTransportLeg" || command.type === "removeLeg") {
      const leg = findTransportLeg(graph, command.legId, command.bucket);
      await purgeTransportItineraryForRemovedLeg(tripId, command.legId, leg);
    }
  }

  const result = applyCommands(graph, normalized);

  for (const command of normalized) {
    if (isMetaCommand(command)) {
      if (
        command.type === "createGroup" ||
        command.type === "updateGroup" ||
        command.type === "deleteGroup"
      ) {
        await persistGroupCommand(tripId, command);
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

  const stateCommands = normalized.filter((c) => !isMetaCommand(c));
  if (stateCommands.length > 0) {
    const activeGroupId = groupIdFromCommand(stateCommands[0]!) ?? graph.mainGroupId;
    if (stateCommands.every(isBasicsOnlyCommand)) {
      await persistBasicsCommand(tripId, result.graph.basics);
    } else {
      const syncTransportItems = commandsNeedTransportItinerarySync(stateCommands);
      await applyTripSetupState(tripId, graphToSetupState(result.graph), {
        activeGroupId,
        skipWizardItineraryItems: true,
        syncTransportItems,
      });
      await syncActivitiesForTrip(tripId, result.graph.activities);
      await reconcileTransportItineraryItems(tripId, {
        outboundLegs: result.graph.outboundLegs,
        returnLegs: result.graph.returnLegs,
        intercityLegs: result.graph.intercityLegs,
      });
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
