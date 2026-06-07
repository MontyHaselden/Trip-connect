import type { TransportType } from "@/lib/host/wizard/types";
import { TRANSPORT_TYPES } from "@/lib/host/wizard/types";

export const LOCAL_TRANSPORT_TYPES = TRANSPORT_TYPES.filter((t) => t !== "plane");

export type ActivityTransportLeg = {
  transportType: TransportType;
  leaveByTime: string | null;
  durationMinutes: number | null;
  note: string | null;
};

export type ActivityTransportDraft = {
  there: ActivityTransportLeg | null;
  back: ActivityTransportLeg | null;
};

const TRANSPORT_LABELS: Record<TransportType, string> = {
  unsure: "Unsure",
  plane: "Plane",
  train: "Train",
  bus: "Bus",
  coach: "Coach",
  ferry: "Ferry",
  car: "Car",
  taxi: "Taxi / shuttle",
  walking: "Walking",
  other: "Other",
};

const labelToType = new Map(
  Object.entries(TRANSPORT_LABELS).map(([type, label]) => [label.toLowerCase(), type as TransportType]),
);

function emptyLeg(): ActivityTransportLeg {
  return {
    transportType: "unsure",
    leaveByTime: null,
    durationMinutes: null,
    note: null,
  };
}

function formatLeg(prefix: string, leg: ActivityTransportLeg): string | null {
  if (leg.transportType === "unsure" && !leg.leaveByTime && !leg.durationMinutes && !leg.note?.trim()) {
    return null;
  }
  const typeLabel = TRANSPORT_LABELS[leg.transportType];
  let line = `${prefix}: ${typeLabel}`;
  if (leg.leaveByTime) line += `, leave ${leg.leaveByTime}`;
  if (leg.durationMinutes && leg.durationMinutes > 0) line += ` (~${leg.durationMinutes} min)`;
  if (leg.note?.trim()) line += ` — ${leg.note.trim()}`;
  return line;
}

export function formatActivityTransport(draft: ActivityTransportDraft): string | null {
  const lines = [
    draft.there ? formatLeg("Getting there", draft.there) : null,
    draft.back ? formatLeg("Getting back", draft.back) : null,
  ].filter(Boolean) as string[];
  return lines.length ? lines.join("\n") : null;
}

export function primaryLeaveByTime(draft: ActivityTransportDraft): string | null {
  return draft.there?.leaveByTime?.trim() || null;
}

const LEG_LINE =
  /^(Getting there|Getting back): ([^,]+?)(?:, leave (\d{1,2}:\d{2}))?(?: \(~(\d+) min\))?(?: — (.+))?$/;

function parseLegLine(line: string): { direction: "there" | "back"; leg: ActivityTransportLeg } | null {
  const match = line.trim().match(LEG_LINE);
  if (!match) return null;
  const [, directionLabel, typeLabel, leaveByTime, duration, note] = match;
  const rawType = typeLabel.trim().toLowerCase();
  const localType = (LOCAL_TRANSPORT_TYPES as readonly string[]).includes(rawType)
    ? (rawType as Exclude<TransportType, "plane">)
    : null;
  const transportType: TransportType = labelToType.get(rawType) ?? localType ?? "other";
  return {
    direction: directionLabel === "Getting back" ? "back" : "there",
    leg: {
      transportType,
      leaveByTime: leaveByTime ?? null,
      durationMinutes: duration ? Number(duration) : null,
      note: note?.trim() || null,
    },
  };
}

function looksLikeStoredAddress(text: string): boolean {
  const t = text.trim();
  if (t.length < 20) return false;
  return /,\s*\d/.test(t) || /\d{3,}.*,/.test(t);
}

export function parseActivityTransport(
  transportNote: string | null,
  leaveByTime: string | null,
): ActivityTransportDraft {
  const draft: ActivityTransportDraft = { there: null, back: null };

  if (transportNote?.trim()) {
    const lines = transportNote.split("\n").map((l) => l.trim()).filter(Boolean);
    let parsedAny = false;
    for (const line of lines) {
      const parsed = parseLegLine(line);
      if (!parsed) continue;
      parsedAny = true;
      if (parsed.direction === "back") draft.back = parsed.leg;
      else draft.there = parsed.leg;
    }
    if (!parsedAny && transportNote.trim() && !looksLikeStoredAddress(transportNote)) {
      draft.there = { ...emptyLeg(), note: transportNote.trim() };
    }
  }

  const leave = leaveByTime?.trim().slice(0, 5) || null;
  if (leave) {
    draft.there = { ...(draft.there ?? emptyLeg()), leaveByTime: leave };
  }

  return draft;
}

export function transportLabel(type: TransportType): string {
  return TRANSPORT_LABELS[type];
}
