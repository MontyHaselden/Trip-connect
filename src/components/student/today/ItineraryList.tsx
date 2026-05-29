"use client";

import { formatRelativeFromNow, formatTripTime, tripLocalDateTime } from "@/lib/utils/time";
import { ItineraryRow, type ItineraryRowItem } from "./ItineraryRow";

export function ItineraryList(props: {
  items: ItineraryRowItem[];
  tripTimezone: string;
  dateISO: string;
  mapsOnline: boolean;
  showUpNext: boolean;
  prepItems: Array<{ id: string; text: string }>;
}) {
  const { items, tripTimezone, dateISO, mapsOnline, showUpNext, prepItems } = props;

  const nowMs = Date.now();
  const upcoming = showUpNext
    ? items
        .map((item) => ({
          item,
          start: tripLocalDateTime({
            dateISO,
            timeHHMMSS: item.startTime,
            tripTimezone,
          }),
        }))
        .filter((x) => x.start.toMillis() >= nowMs - 2 * 60 * 1000)
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())[0]
    : null;

  if (!items.length && !prepItems.length) {
    return null;
  }

  return (
    <div className="pt-2">
      {upcoming ? (
        <p className="mb-4 border-b border-zinc-100 pb-4 text-sm text-zinc-500">
          Up next · starts {formatRelativeFromNow(upcoming.start)} ·{" "}
          {formatTripTime(upcoming.item.startTime, tripTimezone)} —{" "}
          {upcoming.item.title}
        </p>
      ) : null}

      {items.length ? (
        <div>
          {items.map((item, i) => (
            <ItineraryRow
              key={item.id}
              item={item}
              tripTimezone={tripTimezone}
              mapsEnabled={mapsOnline}
              isLast={i === items.length - 1 && !prepItems.length}
            />
          ))}
        </div>
      ) : null}

      {prepItems.length ? (
        <section className={items.length ? "mt-6 border-t border-zinc-200/80 pt-5" : ""}>
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Prep for tomorrow
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {prepItems.map((p) => (
              <li key={p.id} className="flex gap-2">
                <span className="text-zinc-400">·</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
