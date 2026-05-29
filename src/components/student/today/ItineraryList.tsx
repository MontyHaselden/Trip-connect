"use client";

import { useEffect, useMemo, useRef } from "react";

import { tripLocalDateTime } from "@/lib/utils/time";
import type { ItineraryRowItem } from "@/lib/utils/itinerary-item-style";
import { ItineraryRow } from "./ItineraryRow";

function pickFeaturedIndex(
  items: ItineraryRowItem[],
  dateISO: string,
  tripTimezone: string,
  isViewingToday: boolean,
): number {
  if (!items.length) return -1;
  if (!isViewingToday) return 0;

  const nowMs = Date.now();
  const withStart = items.map((item, index) => ({
    index,
    start: tripLocalDateTime({
      dateISO,
      timeHHMMSS: item.startTime,
      tripTimezone,
    }),
  }));

  const upcoming = withStart.find((x) => x.start.toMillis() >= nowMs - 2 * 60 * 1000);
  if (upcoming) return upcoming.index;

  const lastStarted = [...withStart].reverse().find((x) => x.start.toMillis() <= nowMs);
  return lastStarted?.index ?? 0;
}

export function ItineraryList(props: {
  items: ItineraryRowItem[];
  tripTimezone: string;
  dateISO: string;
  mapsOnline: boolean;
  isViewingToday: boolean;
  prepItems: Array<{ id: string; text: string }>;
}) {
  const { items, tripTimezone, dateISO, mapsOnline, isViewingToday, prepItems } =
    props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);

  const featuredIndex = useMemo(
    () => pickFeaturedIndex(items, dateISO, tripTimezone, isViewingToday),
    [items, dateISO, tripTimezone, isViewingToday],
  );

  const beforeItems = featuredIndex > 0 ? items.slice(0, featuredIndex) : [];
  const featuredItem = featuredIndex >= 0 ? items[featuredIndex] : null;
  const afterItems =
    featuredIndex >= 0 ? items.slice(featuredIndex + 1) : items;

  const featuredLabel = isViewingToday ? "Now" : "Up first";
  const showYesterdaySlot = !isViewingToday && beforeItems.length === 0;

  useEffect(() => {
    const container = scrollRef.current;
    const featured = featuredRef.current;
    if (!container || !featured) return;

    const top = featured.offsetTop - 56;
    container.scrollTop = Math.max(0, top);
  }, [dateISO, featuredIndex]);

  if (!items.length && !prepItems.length) {
    return null;
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
    >
      <div className="h-2 shrink-0" aria-hidden />

      {beforeItems.length ? (
        <section className="pb-2">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            {isViewingToday ? "Earlier today" : "Before"}
          </p>
          {beforeItems.map((item, i) => (
            <ItineraryRow
              key={item.id}
              item={item}
              tripTimezone={tripTimezone}
              mapsEnabled={mapsOnline}
              isLast={i === beforeItems.length - 1}
            />
          ))}
        </section>
      ) : null}

      {showYesterdaySlot ? (
        <p className="mb-2 py-2 text-center text-sm font-medium text-zinc-400">
          Yesterday
        </p>
      ) : null}

      {featuredItem ? (
        <div
          ref={featuredRef}
          className="sticky top-0 z-10 bg-zinc-50/95 py-2 backdrop-blur supports-[backdrop-filter]:bg-zinc-50/80"
        >
          <ItineraryRow
            item={featuredItem}
            tripTimezone={tripTimezone}
            mapsEnabled={mapsOnline}
            variant="featured"
            featuredLabel={featuredLabel}
          />
        </div>
      ) : null}

      {afterItems.length ? (
        <section className="pt-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
            {isViewingToday ? "Later today" : "Rest of day"}
          </p>
          {afterItems.map((item, i) => (
            <ItineraryRow
              key={item.id}
              item={item}
              tripTimezone={tripTimezone}
              mapsEnabled={mapsOnline}
              isLast={i === afterItems.length - 1 && !prepItems.length}
            />
          ))}
        </section>
      ) : null}

      {prepItems.length ? (
        <section className="mt-6 border-t border-zinc-200/80 pt-5">
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

      <div className="h-6 shrink-0" aria-hidden />
    </div>
  );
}
