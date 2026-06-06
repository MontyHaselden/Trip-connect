"use client";

import { buildMapsSearchUrl } from "@/lib/utils/maps";
import {
  categoryAccent,
  durationLabel,
  itemExtraInfoLines,
  itemLocationLine,
  resolveCategory,
  type ItineraryRowItem,
} from "@/lib/utils/itinerary-item-style";
import { formatItineraryTimeRange } from "@/lib/utils/time";

export function ActivityDetailSheet(props: {
  item: ItineraryRowItem | null;
  tripTimezone: string;
  mapsEnabled: boolean;
  onClose: () => void;
}) {
  const { item, tripTimezone, mapsEnabled, onClose } = props;

  if (!item) return null;

  const category = resolveCategory(item);
  const accent = categoryAccent(category);
  const timeLabel = formatItineraryTimeRange(
    item.startTime,
    item.endTime,
    tripTimezone,
  );
  const dur = durationLabel(item.startTime, item.endTime, tripTimezone);
  const locationLine = itemLocationLine(item);
  const extraLines = itemExtraInfoLines(item);
  const mapsQuery = item.mapQuery || item.address || "";
  const mapsUrl = mapsQuery ? buildMapsSearchUrl(mapsQuery) : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <div className="relative mx-auto w-full max-w-md max-h-[85dvh] overflow-hidden rounded-2xl bg-white px-4 py-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} />
              <span className="text-[11px] font-medium text-zinc-500">
                {accent.label}
              </span>
            </div>
            <h2 className="mt-1 break-words text-base font-semibold text-zinc-900">
              {item.title}
            </h2>
            <p className="mt-0.5 text-sm tabular-nums text-zinc-600">
              {timeLabel}
              {dur ? ` · ${dur}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm font-medium text-zinc-600"
          >
            Done
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto text-sm text-zinc-600">
          {locationLine ? (
            <p className="break-words">{locationLine}</p>
          ) : null}
          {extraLines.map((line, i) => (
            <p key={i} className="break-words">
              {line}
            </p>
          ))}
          {mapsUrl && mapsEnabled ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2"
            >
              Map
            </a>
          ) : null}
          {!locationLine && !extraLines.length && !(mapsUrl && mapsEnabled) ? (
            <p className="text-zinc-400">No extra details.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
