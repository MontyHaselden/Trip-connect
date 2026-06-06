import { DateTime } from "luxon";

import type { ActivityCategory } from "@/types/activity-category";

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
  category?: ActivityCategory | null;
};

/** @deprecated Use ActivityCategory */
export type ItemKind = ActivityCategory;

export function inferCategoryFromTitle(title: string): ActivityCategory {
  const t = title.trim().toLowerCase();
  if (!t) return "other";
  if (/(arrive|arrival|landing|touch down|welcome)/.test(t)) return "important";
  if (/(meeting|briefing|assembly|orientation)/.test(t)) return "meeting";
  if (/(hotel|check.?in|check.?out|accommodation|lodging)/.test(t)) return "hotel";
  if (
    /(flight|airport|depart|departure|transfer|bus|coach|train|metro|subway|ferry|drive|shuttle|travel)/.test(
      t,
    )
  ) {
    return "travel";
  }
  if (/(breakfast|lunch|dinner|meal|eat|restaurant|cafe|coffee)/.test(t)) return "meal";
  if (/(school|class|lesson|lecture|study)/.test(t)) return "school";
  if (/(free|rest|downtime|at leisure)/.test(t)) return "free_time";
  if (/(tour|museum|activity|match|practice|visit|shopping|game|shrine|temple)/.test(t)) {
    return "activity";
  }
  return "other";
}

export function resolveCategory(item: ItineraryRowItem): ActivityCategory {
  if (item.category) return item.category;
  return inferCategoryFromTitle(item.title);
}

/** @deprecated Use resolveCategory */
export function inferKind(title: string): ActivityCategory {
  return inferCategoryFromTitle(title);
}

export function categoryAccent(category: ActivityCategory) {
  switch (category) {
    case "travel":
      return {
        dot: "bg-sky-500",
        bar: "bg-sky-500",
        label: "Travel",
      };
    case "meal":
      return {
        dot: "bg-amber-500",
        bar: "bg-amber-500",
        label: "Meal",
      };
    case "school":
      return {
        dot: "bg-indigo-400",
        bar: "bg-indigo-400",
        label: "School",
      };
    case "activity":
      return {
        dot: "bg-violet-400",
        bar: "bg-violet-400",
        label: "Activity",
      };
    case "free_time":
      return {
        dot: "bg-zinc-300",
        bar: "bg-zinc-300",
        label: "Free time",
      };
    case "hotel":
      return {
        dot: "bg-teal-500",
        bar: "bg-teal-500",
        label: "Hotel",
      };
    case "meeting":
      return {
        dot: "bg-rose-400",
        bar: "bg-rose-400",
        label: "Meeting",
      };
    case "important":
      return {
        dot: "bg-emerald-500",
        bar: "bg-emerald-500",
        label: "Important",
      };
    default:
      return {
        dot: "bg-zinc-300",
        bar: "bg-zinc-300",
        label: "Event",
      };
  }
}

/** @deprecated Use categoryAccent */
export function kindAccent(kind: ActivityCategory) {
  const accent = categoryAccent(kind);
  return {
    bar: accent.bar,
    chip: "bg-zinc-100 text-zinc-700 ring-zinc-200",
    label: accent.label,
    featured: "border-zinc-200 bg-white",
  };
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

export function formatCompactStartTime(timeHHMMSS: string, tripTimezone: string): string {
  const dt = DateTime.fromISO(`1970-01-01T${timeHHMMSS}`, { zone: tripTimezone });
  return dt.toFormat("HH:mm");
}
