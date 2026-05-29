"use client";

import { formatItineraryTimeRange } from "@/lib/utils/time";
import { buildMapsSearchUrl } from "@/lib/utils/maps";

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
      <p className="text-[15px] leading-snug text-zinc-900">
        <span className="font-medium tabular-nums">{timeLabel}</span>
        <span className="text-zinc-400"> — </span>
        <span>{item.title}</span>
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
    </article>
  );
}
