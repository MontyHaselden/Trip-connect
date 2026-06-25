import { newId } from "@/lib/host/wizard/types";
import type { ActivityDraft } from "@/lib/host/wizard/types";

import { normalizeCommand, type TripCommand } from "./commands";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readCommandType(entry: Record<string, unknown>): string | null {
  const type = readString(entry, "type", "command", "commandType", "action");
  if (type) return type;
  if (asRecord(entry.activity)) return "addActivity";
  if (readString(entry, "title") && readString(entry, "date")) return "addActivity";
  if (asRecord(entry.stay)) return "addStay";
  if (asRecord(entry.leg)) return "addTransportLeg";
  if (Array.isArray(entry.legs)) return "addClassifiedTransportLegs";
  if (Array.isArray(entry.days)) return "setDayPlaces";
  return null;
}

function coerceActivityDraft(raw: Record<string, unknown>): ActivityDraft | null {
  const title = readString(raw, "title", "name", "label");
  const date = readString(raw, "date", "day", "isoDate");
  if (!title || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const locationName =
    readString(raw, "locationName", "location", "city") || null;

  return {
    id: readString(raw, "id") || newId(),
    title,
    date,
    endDate: readString(raw, "endDate") || null,
    startTime: readString(raw, "startTime", "time") || null,
    endTime: readString(raw, "endTime") || null,
    isTimeTbc: Boolean(raw.isTimeTbc),
    category: (readString(raw, "category") || "activity") as ActivityDraft["category"],
    locationName,
    address: readString(raw, "address") || null,
    isLocationTbc: raw.isLocationTbc !== false && !locationName,
    transportNote: readString(raw, "transportNote") || null,
    leaveByTime: readString(raw, "leaveByTime") || null,
    bringNote: readString(raw, "bringNote") || null,
    description: readString(raw, "description") || null,
    audienceType: (readString(raw, "audienceType") || "everyone") as ActivityDraft["audienceType"],
    audienceId: readString(raw, "audienceId") || null,
    bookingStatus: (readString(raw, "bookingStatus") || "not_booked") as ActivityDraft["bookingStatus"],
    originGroupId: readString(raw, "originGroupId") || null,
  };
}

/** Flatten nested AI shapes like `{ activities: [...] }` into individual command entries. */
export function expandProposedCommandEntries(
  raw: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const entry of raw) {
    if (Array.isArray(entry.activities)) {
      for (const activity of entry.activities) {
        const record = asRecord(activity);
        if (record) out.push({ type: "addActivity", activity: record });
      }
      continue;
    }
    out.push(entry);
  }
  return out;
}

export function coerceProposedCommandEntry(
  entry: Record<string, unknown>,
  groupId: string,
): { command: TripCommand | null; warning?: string } {
  const type = readCommandType(entry);
  if (!type) {
    return {
      command: null,
      warning: "Skipped a proposed change — missing command type.",
    };
  }

  const cmdGroup = readString(entry, "groupId") || groupId;

  if (type === "addActivity") {
    const rawActivity = asRecord(entry.activity) ?? entry;
    const activity = coerceActivityDraft(rawActivity);
    if (!activity) {
      return {
        command: null,
        warning: "Skipped addActivity — each activity needs a title and ISO date (YYYY-MM-DD).",
      };
    }
    return {
      command: normalizeCommand({
        type: "addActivity",
        groupId: cmdGroup,
        activity,
      }),
    };
  }

  const command = normalizeCommand({
    ...entry,
    type,
    groupId: cmdGroup,
  } as { type: string } & Record<string, unknown>);

  if (!command.type) {
    return { command: null, warning: `Skipped unsupported command: ${type}` };
  }

  return { command };
}

export function coerceProposedCommands(
  raw: Array<Record<string, unknown>>,
  groupId: string,
): { commands: TripCommand[]; warnings: string[] } {
  const commands: TripCommand[] = [];
  const warnings: string[] = [];

  for (const entry of expandProposedCommandEntries(raw)) {
    const result = coerceProposedCommandEntry(entry, groupId);
    if (result.command) commands.push(result.command);
    else if (result.warning) warnings.push(result.warning);
  }

  return { commands, warnings };
}
