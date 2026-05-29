"use client";

import { formatItineraryTimeRange } from "@/lib/utils/time";
import { buildMapsSearchUrl } from "@/lib/utils/maps";
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

type ItemKind = "travel" | "arrival" | "meal" | "activity" | "free" | "other";

function inferKind(title: string): ItemKind {
  const t = title.trim().toLowerCase();
  if (!t) return "other";
  if (/(arrive|arrival|landing|touch down|welcome)/.test(t)) return "arrival";
  if (/(flight|airport|depart|departure|transfer|bus|coach|train|metro|subway|ferry|drive|shuttle)/.test(t)) {
    return "travel";
  }
  if (/(breakfast|lunch|dinner|meal|eat|restaurant|cafe|coffee)/.test(t)) return "meal";
  if (/(free|rest|downtime|at leisure)/.test(t)) return "free";
  if (/(tour|museum|activity|class|match|practice|visit|shopping|game)/.test(t)) return "activity";
  return "other";
}

function kindAccent(kind: ItemKind) {
  switch (kind) {
    case "travel":
      return { bar: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-200", label: "Travel" };
    case "arrival":
      return { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "Arrival" };
    case "meal":
      return { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-800 ring-amber-200", label: "Meal" };
    case "activity":
      return { bar: "bg-violet-500", chip: "bg-violet-50 text-violet-700 ring-violet-200", label: "Activity" };
    case "free":
      return { bar: "bg-zinc-300", chip: "bg-zinc-100 text-zinc-700 ring-zinc-200", label: "Free time" };
    default:
      return { bar: "bg-zinc-200", chip: "bg-zinc-100 text-zinc-700 ring-zinc-200", label: "Event" };
  }
}

function durationLabel(startTime: string, endTime: string | null, tripTimezone: string) {
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

export function ItineraryRow(props: {
  item: ItineraryRowItem;
  tripTimezone: string;
  mapsEnabled: boolean;
  isLast?: boolean;
}) {
  const { item, tripTimezone, mapsEnabled, isLast } = props;

  const timeLabel = formatItineraryTimeRange(
    item.startTime,
    item.endTime,
    tripTimezone,
  );
  const kind = inferKind(item.title);
  const accent = kindAccent(kind);
  const dur = durationLabel(item.startTime, item.endTime, tripTimezone);
  const mapsQuery = item.mapQuery || item.address || "";
  const mapsUrl = mapsQuery ? buildMapsSearchUrl(mapsQuery) : null;

  const secondary: string[] = [];
  if (item.locationName) secondary.push(item.locationName);
  if (item.address && item.address !== item.locationName) {
    secondary.push(item.address);
  }
  if (item.transportNote) secondary.push(item.transportNote);
  if (item.bringNote) secondary.push(item.bringNote);
  if (item.hostNote) secondary.push(item.hostNote);

  return (
    <article
      className={[
        "py-3.5",
        isLast ? "" : "border-b border-zinc-100",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className={["mt-1 h-10 w-1 rounded-full", accent.bar].join(" ")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium tabular-nums text-zinc-800">
              {timeLabel}
            </p>
            <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", accent.chip].join(" ")}>
              {accent.label}
            </span>
            {dur ? (
              <span className="text-[11px] font-medium text-zinc-500">
                {dur}
              </span>
            ) : null}
          </div>

          <p
            className={[
              "mt-1 text-[15px] leading-snug text-zinc-900",
              kind === "arrival" ? "font-semibold" : "font-medium",
            ].join(" ")}
          >
            {kind === "arrival" && !/welcome/i.test(item.title)
              ? `Welcome! ${item.title}`
              : item.title}
          </p>

          {secondary.length ? (
            <div className="mt-1.5 space-y-0.5 text-sm leading-relaxed text-zinc-500">
              {secondary.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : null}

          {mapsUrl && mapsEnabled ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2"
            >
              Map
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
