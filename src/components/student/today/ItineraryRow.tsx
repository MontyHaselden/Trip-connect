"use client";

import { formatItineraryTimeRange } from "@/lib/utils/time";
import { buildMapsSearchUrl } from "@/lib/utils/maps";
import {
  durationLabel,
  inferKind,
  itemSecondaryLines,
  kindAccent,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";

export type { ItineraryRowItem };

export function ItineraryRow(props: {
  item: ItineraryRowItem;
  tripTimezone: string;
  mapsEnabled: boolean;
  isLast?: boolean;
  variant?: "default" | "featured";
  featuredLabel?: string;
}) {
  const {
    item,
    tripTimezone,
    mapsEnabled,
    isLast,
    variant = "default",
    featuredLabel,
  } = props;

  const featured = variant === "featured";
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
  const secondary = itemSecondaryLines(item);

  if (featured) {
    return (
      <article
        className={[
          "w-full min-w-0 rounded-2xl border-2 p-4 shadow-sm ring-1 ring-inset ring-black/5",
          accent.featured,
        ].join(" ")}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {featuredLabel ?? "Now"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold tabular-nums text-zinc-900">
            {timeLabel}
          </p>
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              accent.chip,
            ].join(" ")}
          >
            {accent.label}
          </span>
          {dur ? (
            <span className="text-xs font-medium text-zinc-600">{dur}</span>
          ) : null}
        </div>
        <p
          className={[
            "mt-2 break-words text-xl font-bold leading-snug text-zinc-900",
            kind === "arrival" ? "text-emerald-950" : "",
          ].join(" ")}
        >
          {kind === "arrival" && !/welcome/i.test(item.title)
            ? `Welcome! ${item.title}`
            : item.title}
        </p>
        {secondary.length ? (
          <div className="mt-2 space-y-1 text-sm leading-relaxed text-zinc-600">
            {secondary.map((line, i) => (
              <p key={i} className="break-words">
                {line}
              </p>
            ))}
          </div>
        ) : null}
        {mapsUrl && mapsEnabled ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2"
          >
            Map
          </a>
        ) : null}
      </article>
    );
  }

  return (
    <article
      className={["min-w-0 py-3.5", isLast ? "" : "border-b border-zinc-100"].join(" ")}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={["mt-1 h-10 w-1 rounded-full", accent.bar].join(" ")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium tabular-nums text-zinc-800">
              {timeLabel}
            </p>
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                accent.chip,
              ].join(" ")}
            >
              {accent.label}
            </span>
            {dur ? (
              <span className="text-[11px] font-medium text-zinc-500">{dur}</span>
            ) : null}
          </div>
          <p
            className={[
              "mt-1 break-words text-[15px] leading-snug text-zinc-900",
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
                <p key={i} className="break-words">
                  {line}
                </p>
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
