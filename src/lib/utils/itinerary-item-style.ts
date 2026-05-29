import { DateTime } from "luxon";

export type ItineraryRowItem = {
  id: string;
  startTime: string;
  endTime: string | null;
  title: string;
  locationName: string | null;
  address: string | null;
  mapQuery: string | null;
  transportNote: string | null;
  bringNote: string | null;
  hostNote: string | null;
};

export type ItemKind = "travel" | "arrival" | "meal" | "activity" | "free" | "other";

export function inferKind(title: string): ItemKind {
  const t = title.trim().toLowerCase();
  if (!t) return "other";
  if (/(arrive|arrival|landing|touch down|welcome)/.test(t)) return "arrival";
  if (
    /(flight|airport|depart|departure|transfer|bus|coach|train|metro|subway|ferry|drive|shuttle)/.test(
      t,
    )
  ) {
    return "travel";
  }
  if (/(breakfast|lunch|dinner|meal|eat|restaurant|cafe|coffee)/.test(t)) return "meal";
  if (/(free|rest|downtime|at leisure)/.test(t)) return "free";
  if (/(tour|museum|activity|class|match|practice|visit|shopping|game)/.test(t)) {
    return "activity";
  }
  return "other";
}

export function kindAccent(kind: ItemKind) {
  switch (kind) {
    case "travel":
      return {
        bar: "bg-sky-500",
        chip: "bg-sky-50 text-sky-700 ring-sky-200",
        label: "Travel",
        featured: "border-sky-200 bg-sky-50/80",
      };
    case "arrival":
      return {
        bar: "bg-emerald-500",
        chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
        label: "Arrival",
        featured: "border-emerald-200 bg-emerald-50/80",
      };
    case "meal":
      return {
        bar: "bg-amber-500",
        chip: "bg-amber-50 text-amber-800 ring-amber-200",
        label: "Meal",
        featured: "border-amber-200 bg-amber-50/80",
      };
    case "activity":
      return {
        bar: "bg-violet-500",
        chip: "bg-violet-50 text-violet-700 ring-violet-200",
        label: "Activity",
        featured: "border-violet-200 bg-violet-50/80",
      };
    case "free":
      return {
        bar: "bg-zinc-300",
        chip: "bg-zinc-100 text-zinc-700 ring-zinc-200",
        label: "Free time",
        featured: "border-zinc-200 bg-zinc-50",
      };
    default:
      return {
        bar: "bg-zinc-200",
        chip: "bg-zinc-100 text-zinc-700 ring-zinc-200",
        label: "Event",
        featured: "border-zinc-200 bg-white",
      };
  }
}

export function durationLabel(
  startTime: string,
  endTime: string | null,
  tripTimezone: string,
) {
  if (!endTime) return null;
  const start = DateTime.fromISO(`1970-01-01T${startTime}`, { zone: tripTimezone });
  const end = DateTime.fromISO(`1970-01-01T${endTime}`, { zone: tripTimezone });
  const mins = Math.round(end.diff(start, "minutes").minutes);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function itemLocationLine(item: ItineraryRowItem): string | null {
  if (item.locationName) return item.locationName;
  if (item.address) return item.address;
  return null;
}

export function itemExtraInfoLines(item: ItineraryRowItem): string[] {
  const lines: string[] = [];
  if (item.address && item.address !== item.locationName) lines.push(item.address);
  if (item.transportNote) lines.push(item.transportNote);
  if (item.bringNote) lines.push(item.bringNote);
  if (item.hostNote) lines.push(item.hostNote);
  return lines;
}

export function itemSecondaryLines(item: ItineraryRowItem): string[] {
  const location = itemLocationLine(item);
  return location ? [location, ...itemExtraInfoLines(item)] : itemExtraInfoLines(item);
}
