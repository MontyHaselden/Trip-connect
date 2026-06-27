import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";

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

/** Collapse rapid duplicate calendar/transport intents before a persist batch. */
export function coalescePendingCommands(commands: TripCommand[]): TripCommand[] {
  if (commands.length <= 1) return commands;

  const result: TripCommand[] = [];
  const paintIndex = new Map<string, number>();
  const needIndex = new Map<string, number>();
  const addLegIndex = new Map<string, number>();

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

    result.push(command);
  }

  return result;
}
