import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import {
  sanitizeDayPlaceDraft,
} from "@/lib/trip-engine/sanitize-day-place";

function addActivityContentKey(
  command: Extract<TripCommand, { type: "addActivity" }>,
): string {
  return [
    command.activity.date,
    command.activity.title.trim().toLowerCase(),
    command.activity.originGroupId ?? command.groupId,
  ].join("|");
}

function legEndpointCities(leg: TransportLegDraft | IntercityLegDraft): {
  fromCity: string;
  toCity: string;
} {
  if ("intercityFromCity" in leg) {
    return {
      fromCity: leg.intercityFromCity?.trim() || leg.fromCity?.trim() || "",
      toCity: leg.intercityToCity?.trim() || leg.toCity?.trim() || "",
    };
  }
  return {
    fromCity: leg.fromCity?.trim() || "",
    toCity: leg.toCity?.trim() || "",
  };
}

function paintDayRangeKey(command: Extract<TripCommand, { type: "paintDayRange" }>): string {
  return [
    command.groupId,
    command.rangeStart,
    command.rangeEnd,
    command.startHalf ?? "full",
    command.endHalf ?? "full",
  ].join("|");
}

function pendingNeedKey(
  command: Extract<TripCommand, { type: "hidePendingTransportNeed" | "unhidePendingTransportNeed" }>,
): string {
  const { need } = command;
  return [command.groupId, need.kind, need.date, need.fromCity, need.toCity].join("|");
}

function transportLegKey(
  command: Extract<TripCommand, { type: "addTransportLeg" }>,
): string {
  const leg = command.leg;
  const { fromCity, toCity } = legEndpointCities(leg);
  return [
    command.groupId,
    command.bucket ?? "intercity",
    leg.travelDate,
    fromCity,
    toCity,
  ].join("|");
}

function mergeCoalescedDayPlaces(
  existing: Extract<TripCommand, { type: "setDayPlaces" }>["days"],
  incoming: Extract<TripCommand, { type: "setDayPlaces" }>["days"],
): Extract<TripCommand, { type: "setDayPlaces" }>["days"] {
  const byDate = new Map(
    existing
      .filter((day) => Boolean(day?.date))
      .map((day) => [day.date, sanitizeDayPlaceDraft(day)]),
  );
  for (const day of incoming) {
    if (!day?.date) continue;
    byDate.set(day.date, sanitizeDayPlaceDraft(day));
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function updateTransportLegKey(
  command: Extract<TripCommand, { type: "updateTransportLeg" }>,
): string {
  return [command.groupId, command.bucket, command.legId].join("|");
}

function classifiedTransportLegsKey(
  command: Extract<TripCommand, { type: "addClassifiedTransportLegs" }>,
): string {
  const leg = command.legs[0];
  if (!leg) return command.groupId;
  const { fromCity, toCity } = legEndpointCities(leg);
  return [command.groupId, leg.travelDate, fromCity, toCity].join("|");
}

/** Collapse rapid duplicate calendar/transport intents before a persist batch. */
export function coalescePendingCommands(commands: TripCommand[]): TripCommand[] {
  if (commands.length <= 1) return commands;

  const result: TripCommand[] = [];
  const paintIndex = new Map<string, number>();
  const needIndex = new Map<string, number>();
  const addLegIndex = new Map<string, number>();
  const classifiedLegIndex = new Map<string, number>();
  const updateLegIndex = new Map<string, number>();
  const dayPlacesIndex = new Map<string, number>();
  const addActivityByIdIndex = new Map<string, number>();
  const addActivityByContentIndex = new Map<string, number>();
  const updateActivityIndex = new Map<string, number>();

  for (const command of commands) {
    if (command.type === "paintDayRange") {
      const key = paintDayRangeKey(command);
      const existing = paintIndex.get(key);
      if (existing !== undefined) {
        result[existing] = command;
      } else {
        paintIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    if (
      command.type === "hidePendingTransportNeed" ||
      command.type === "unhidePendingTransportNeed"
    ) {
      const key = pendingNeedKey(command);
      const existing = needIndex.get(key);
      if (existing !== undefined) {
        result[existing] = command;
      } else {
        needIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    if (command.type === "addTransportLeg") {
      const key = transportLegKey(command);
      const existing = addLegIndex.get(key);
      if (existing !== undefined) {
        result[existing] = command;
      } else {
        addLegIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    if (command.type === "addClassifiedTransportLegs") {
      const key = classifiedTransportLegsKey(command);
      const existing = classifiedLegIndex.get(key);
      if (existing !== undefined) {
        result[existing] = command;
      } else {
        classifiedLegIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    if (command.type === "updateTransportLeg") {
      const key = updateTransportLegKey(command);
      const existing = updateLegIndex.get(key);
      if (existing !== undefined) {
        const prev = result[existing];
        if (prev?.type === "updateTransportLeg") {
          result[existing] = {
            ...command,
            patch: { ...prev.patch, ...command.patch },
          };
        } else {
          result.push(command);
        }
      } else {
        updateLegIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    if (command.type === "setDayPlaces") {
      const key = command.groupId;
      const existing = dayPlacesIndex.get(key);
      if (existing !== undefined) {
        const prev = result[existing];
        if (prev?.type === "setDayPlaces") {
          result[existing] = {
            ...command,
            days: mergeCoalescedDayPlaces(prev.days, command.days),
          };
        } else {
          result.push(command);
        }
      } else {
        dayPlacesIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    if (command.type === "addActivity") {
      const idKey = command.activity.id;
      const contentKey = addActivityContentKey(command);
      updateActivityIndex.delete(idKey);

      const contentExisting = addActivityByContentIndex.get(contentKey);
      if (contentExisting !== undefined) {
        const prev = result[contentExisting];
        if (prev?.type === "addActivity") {
          addActivityByIdIndex.delete(prev.activity.id);
        }
        result[contentExisting] = command;
        addActivityByIdIndex.set(idKey, contentExisting);
        addActivityByContentIndex.set(contentKey, contentExisting);
        continue;
      }

      const idExisting = addActivityByIdIndex.get(idKey);
      if (idExisting !== undefined) {
        const prev = result[idExisting];
        if (prev?.type === "addActivity") {
          addActivityByContentIndex.delete(addActivityContentKey(prev));
        }
        result[idExisting] = command;
        addActivityByContentIndex.set(contentKey, idExisting);
      } else {
        addActivityByIdIndex.set(idKey, result.length);
        addActivityByContentIndex.set(contentKey, result.length);
        result.push(command);
      }
      continue;
    }

    if (command.type === "updateActivity") {
      const key = command.activityId;
      const addIdx = addActivityByIdIndex.get(key);
      if (addIdx !== undefined) {
        const prev = result[addIdx];
        if (prev?.type === "addActivity") {
          result[addIdx] = {
            ...prev,
            activity: { ...prev.activity, ...command.patch },
          };
          continue;
        }
      }

      const existing = updateActivityIndex.get(key);
      if (existing !== undefined) {
        const prev = result[existing];
        if (prev?.type === "updateActivity") {
          result[existing] = {
            ...command,
            patch: { ...prev.patch, ...command.patch },
          };
        } else {
          result.push(command);
        }
      } else {
        updateActivityIndex.set(key, result.length);
        result.push(command);
      }
      continue;
    }

    result.push(command);
  }

  return result;
}
