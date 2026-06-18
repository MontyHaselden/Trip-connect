"use client";

import { buildMapsSearchUrl } from "@/lib/utils/maps";
import { useStudentOverlay } from "@/components/student/StudentOverlayContext";
import { studentOverlayRootClass } from "@/lib/student/overlay-classes";
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
  const { contained } = useStudentOverlay();

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
    <div className={studentOverlayRootClass(contained)}>
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="animate-sheet-up relative mx-auto w-full max-w-md overflow-hidden rounded-t-2xl bg-[var(--student-surface)] shadow-xl">
        <div className="flex justify-center pt-2 pb-1">
          <span className="h-1 w-10 rounded-full bg-[var(--student-line)]" />
        </div>
        <div
          className={`overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 ${contained ? "max-h-[75%]" : "max-h-[75dvh]"}`}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--student-text-muted)]">
                  {accent.label}
                </span>
              </div>
              <h2 className="mt-2 break-words text-lg font-bold text-[var(--student-text)]">
                {item.title}
              </h2>
              <p className="mt-1 text-sm tabular-nums text-[var(--student-text-muted)]">
                {timeLabel}
                {dur ? ` · ${dur}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-[var(--student-text-muted)]"
            >
              Done
            </button>
          </div>

          <div className="space-y-3 border-t border-[var(--student-line)] pt-4 text-sm text-[var(--student-text-muted)]">
            {locationLine ? (
              <p className="break-words text-[var(--student-text)]">{locationLine}</p>
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
                className="inline-flex font-semibold text-[var(--student-nav)] underline decoration-[var(--student-line)] underline-offset-2"
              >
                Open in Maps
              </a>
            ) : null}
            {!locationLine && !extraLines.length && !(mapsUrl && mapsEnabled) ? (
              <p className="text-[var(--student-text-muted)]/70">No extra details.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
